"""Offline ball pipeline: frames -> detect -> select -> map -> smooth -> sink.

Wires the pure pieces into the artifact baltfut renders: a per-frame timeline of
the ball in pitch metres. Runs today on a `FakeDetector` + any iterable of frames;
the real `VideoFileSource` + YOLO adapter slot in at the edges later without
touching this wiring.

Note: the tracker steps once per frame (its dt), so velocity/gating are in
per-frame units. The sample `t` is renderer metadata; this assumes a roughly
constant frame interval — fine for v1.
"""

from __future__ import annotations

from typing import Iterable, Optional, Tuple

from .detection import Detector, select_ball
from .pitch import PitchMapper
from .sink import BallSample, Sink
from .tracking import BallTracker

Frame = Tuple[float, object]  # (timestamp_seconds, image)


class BallPipeline:
    """Runs a frame stream through detect -> select -> map -> smooth -> emit."""

    def __init__(
        self,
        *,
        detector: Detector,
        mapper: PitchMapper,
        tracker: BallTracker,
        sink: Sink,
        min_confidence: float = 0.0,
    ) -> None:
        self._detector = detector
        self._mapper = mapper
        self._tracker = tracker
        self._sink = sink
        self._min_conf = min_confidence

    def run(self, frames: Iterable[Frame]) -> int:
        """Process every frame, emit a sample each, return the frame count."""
        n = 0
        try:
            for i, (t, image) in enumerate(frames):
                pixel = select_ball(self._detector.detect(image), self._min_conf)
                pitch_pt: Optional[Tuple[float, float]] = None
                if pixel is not None:
                    mapped = self._mapper.image_to_pitch(pixel)[0]
                    pitch_pt = (float(mapped[0]), float(mapped[1]))
                est = self._tracker.update(pitch_pt)
                self._sink.emit(
                    BallSample(
                        frame=i,
                        t=float(t),
                        position=est.position,
                        observed=est.observed,
                        lost=est.lost,
                    )
                )
                n += 1
        finally:
            self._sink.close()
        return n
