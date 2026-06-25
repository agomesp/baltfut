"""Pitch geometry and the image->pitch homography.

This is the pure core of the ball tracker: it turns a ball's pixel position in a
broadcast frame into a coordinate on a standard football pitch (metres), plus a
0..1 normalised coordinate for baltfut's 2D-field renderer.

Deliberately dependency-light and free of any model or video IO — those live at
the edges (detection.py, source.py) so this layer stays deterministic and fast
to test. Everything here is exercised by tests/test_pitch.py.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

# FIFA standard pitch dimensions, in metres.
DEFAULT_LENGTH = 105.0  # touchline to touchline (x axis)
DEFAULT_WIDTH = 68.0  # goal line to goal line (y axis)


@dataclass(frozen=True)
class Pitch:
    """A football pitch in metres, origin at a corner (x -> length, y -> width)."""

    length: float = DEFAULT_LENGTH
    width: float = DEFAULT_WIDTH

    @property
    def corners(self) -> np.ndarray:
        """The four corners in metres, clockwise from the origin."""
        return np.array(
            [
                [0.0, 0.0],
                [self.length, 0.0],
                [self.length, self.width],
                [0.0, self.width],
            ],
            dtype=np.float64,
        )

    def normalize(self, points) -> np.ndarray:
        """Scale metre coordinates into 0..1 per axis (for the 2D renderer)."""
        pts = np.asarray(points, dtype=np.float64)
        return pts / np.array([self.length, self.width], dtype=np.float64)


class PitchMapper:
    """Projects image-plane pixel points onto pitch metres via a homography."""

    def __init__(self, homography: np.ndarray) -> None:
        h = np.asarray(homography, dtype=np.float64)
        if h.shape != (3, 3):
            raise ValueError("homography must be a 3x3 matrix")
        self._h = h

    @classmethod
    def from_correspondences(cls, image_points, pitch_points) -> "PitchMapper":
        """Fit a homography from >=4 (image_px -> pitch_m) point pairs."""
        img = np.asarray(image_points, dtype=np.float64).reshape(-1, 2)
        pit = np.asarray(pitch_points, dtype=np.float64).reshape(-1, 2)
        if img.shape[0] < 4 or img.shape[0] != pit.shape[0]:
            raise ValueError("need at least 4 matching image/pitch point pairs")
        h, _ = cv2.findHomography(img, pit)
        if h is None:
            raise ValueError("could not fit a homography (degenerate points?)")
        return cls(h)

    def image_to_pitch(self, image_points) -> np.ndarray:
        """Map pixel point(s) to pitch metres. Accepts (2,) or (N, 2)."""
        pts = np.asarray(image_points, dtype=np.float64).reshape(-1, 1, 2)
        mapped = cv2.perspectiveTransform(pts, self._h)
        return mapped.reshape(-1, 2)
