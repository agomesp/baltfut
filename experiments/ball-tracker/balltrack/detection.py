"""Ball detection: the interface, ball-selection logic, and a fake for tests.

The real YOLO adapter (lazily importing ultralytics) lands once we have a model
and a clip to TDD it against. Until then the pipeline runs on `FakeDetector`,
which lets us build and test the whole offline skeleton without torch.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Protocol, Sequence, Tuple

Point = Tuple[float, float]
BBox = Tuple[float, float, float, float]  # x1, y1, x2, y2


@dataclass(frozen=True)
class BallDetection:
    center: Point  # (x, y) in image pixels
    confidence: float
    bbox: Optional[BBox] = None


class Detector(Protocol):
    def detect(self, frame) -> List[BallDetection]:
        """Return zero or more ball candidates for a single frame."""
        ...


def select_ball(detections: Sequence[BallDetection], min_confidence: float = 0.0) -> Optional[Point]:
    """Pick the most confident ball at/above the threshold; None if none qualify."""
    best: Optional[BallDetection] = None
    for d in detections:
        if d.confidence < min_confidence:
            continue
        if best is None or d.confidence > best.confidence:
            best = d
    return best.center if best is not None else None


class FakeDetector:
    """Returns scripted detections per frame — for tests and the offline skeleton.

    ``script`` is aligned to frames; each entry is the list of detections to return
    for that frame (an empty list means the detector saw no ball that frame). Once
    the script is exhausted it returns no detections.
    """

    def __init__(self, script: Sequence[Sequence[BallDetection]]) -> None:
        self._script = [list(frame) for frame in script]
        self._i = 0

    def detect(self, frame) -> List[BallDetection]:
        if self._i >= len(self._script):
            return []
        out = list(self._script[self._i])
        self._i += 1
        return out
