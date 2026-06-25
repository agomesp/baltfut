"""Constant-velocity Kalman smoother for the ball track.

Takes a per-frame stream of ball observations (a detected ``(x, y)`` or ``None``
when the detector found nothing) and produces a smoothed position + velocity.
Three jobs:

  * **smooth** noisy detections toward the underlying trajectory;
  * **predict through gaps** — when a frame has no detection, advance on the
    motion model so the 2D view keeps moving instead of freezing or snapping;
  * **gate out impossible jumps** — reject a detection too far from the
    prediction (a false positive on a sock, a ball-shaped logo) instead of
    letting it yank the track.

Coordinate-agnostic: feed it whatever 2D space you want to smooth in. The
pipeline feeds it pitch *metres* (post-homography), so velocity and the gate are
physically meaningful. (Caveat: a ball in the air violates the on-plane
homography assumption, so airborne phases are smoothed but not physically exact
— a known v1 limitation.)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np

Point = Tuple[float, float]


@dataclass(frozen=True)
class TrackEstimate:
    position: Optional[Point]  # smoothed (x, y), or None before the first detection
    velocity: Optional[Point]  # (vx, vy) per dt, or None before the first detection
    observed: bool             # True if an accepted detection updated this frame
    lost: bool                 # True if there is no usable track right now


class BallTracker:
    """Smooths a stream of ball observations with a constant-velocity model."""

    def __init__(
        self,
        *,
        dt: float = 1.0,
        measurement_noise: float = 1.0,
        process_noise: float = 0.5,
        gate: float = 9.21,  # chi-square 0.99 quantile, 2 dof
        max_missed: int = 30,
        initial_velocity_var: float = 1e3,
    ) -> None:
        self._dt = float(dt)
        self._gate = float(gate)
        self._max_missed = int(max_missed)
        self._init_vel_var = float(initial_velocity_var)
        self._meas_var = float(measurement_noise) ** 2

        # State is [px, py, vx, vy].
        self._F = np.array(
            [
                [1.0, 0.0, self._dt, 0.0],
                [0.0, 1.0, 0.0, self._dt],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ]
        )
        self._H = np.array([[1.0, 0.0, 0.0, 0.0], [0.0, 1.0, 0.0, 0.0]])
        self._R = self._meas_var * np.eye(2)

        # Discrete white-noise acceleration process noise.
        dt2, dt3, dt4 = self._dt ** 2, self._dt ** 3, self._dt ** 4
        q = float(process_noise) ** 2
        self._Q = q * np.array(
            [
                [dt4 / 4, 0.0, dt3 / 2, 0.0],
                [0.0, dt4 / 4, 0.0, dt3 / 2],
                [dt3 / 2, 0.0, dt2, 0.0],
                [0.0, dt3 / 2, 0.0, dt2],
            ]
        )

        self._x: Optional[np.ndarray] = None  # state, or None until first detection
        self._P: Optional[np.ndarray] = None  # state covariance
        self._missed = 0

    def update(self, observation: Optional[Point]) -> TrackEstimate:
        """Advance one frame with an optional detection; return the estimate."""
        if self._x is None:
            # No track yet — a track can only start from a real detection.
            if observation is None:
                return TrackEstimate(None, None, observed=False, lost=True)
            self._init(observation)
            return self._estimate(observed=True)

        # Predict forward one frame.
        self._x = self._F @ self._x
        self._P = self._F @ self._P @ self._F.T + self._Q

        accepted = False
        if observation is not None and self._in_gate(observation):
            self._correct(observation)
            accepted = True

        self._missed = 0 if accepted else self._missed + 1
        return self._estimate(observed=accepted)

    # -- internals ----------------------------------------------------------

    def _init(self, observation: Point) -> None:
        x, y = observation
        self._x = np.array([float(x), float(y), 0.0, 0.0])
        self._P = np.diag(
            [self._meas_var, self._meas_var, self._init_vel_var, self._init_vel_var]
        )
        self._missed = 0

    def _innovation(self, observation: Point):
        z = np.asarray(observation, dtype=np.float64)
        residual = z - self._H @ self._x
        S = self._H @ self._P @ self._H.T + self._R
        return residual, S

    def _in_gate(self, observation: Point) -> bool:
        residual, S = self._innovation(observation)
        d2 = float(residual @ np.linalg.solve(S, residual))
        return d2 <= self._gate

    def _correct(self, observation: Point) -> None:
        residual, S = self._innovation(observation)
        K = self._P @ self._H.T @ np.linalg.inv(S)
        self._x = self._x + K @ residual
        self._P = (np.eye(4) - K @ self._H) @ self._P

    def _estimate(self, *, observed: bool) -> TrackEstimate:
        px, py, vx, vy = self._x
        return TrackEstimate(
            position=(float(px), float(py)),
            velocity=(float(vx), float(vy)),
            observed=observed,
            lost=self._missed > self._max_missed,
        )
