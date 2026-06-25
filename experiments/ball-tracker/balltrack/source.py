"""Frame sources: decode real video into the (timestamp, frame) stream the pipeline eats.

`VideoFileSource` reads a clip with OpenCV, optionally downsampling to a target fps
(we only need ~10 for ball tracking) and capping the frame count. A live
`StreamSource` (streamlink/ffmpeg) is the prod sibling and lands later — it yields
the same `(t, frame)` tuples, so the pipeline never changes.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterator, Optional, Tuple, Union

import cv2

Frame = Tuple[float, object]  # (timestamp_seconds, BGR image ndarray)


class VideoFileSource:
    """Iterable of `(timestamp_seconds, frame)` decoded from a video file."""

    def __init__(
        self,
        path: Union[str, Path],
        *,
        target_fps: Optional[float] = None,
        max_frames: Optional[int] = None,
        assumed_fps: float = 30.0,
    ) -> None:
        self._path = Path(path)
        if not self._path.exists():
            raise FileNotFoundError(self._path)
        self._target_fps = target_fps
        self._max_frames = max_frames
        self._assumed_fps = float(assumed_fps)

    def __iter__(self) -> Iterator[Frame]:
        cap = cv2.VideoCapture(str(self._path))
        if not cap.isOpened():
            cap.release()
            raise ValueError(f"could not open video: {self._path}")
        try:
            src_fps = cap.get(cv2.CAP_PROP_FPS)
            if not src_fps or src_fps <= 0:
                src_fps = self._assumed_fps  # some containers don't report fps
            stride = 1
            if self._target_fps and self._target_fps > 0:
                stride = max(1, round(src_fps / self._target_fps))

            index = 0
            emitted = 0
            while True:
                ok, frame = cap.read()
                if not ok:
                    break
                if index % stride == 0:
                    yield (index / src_fps, frame)
                    emitted += 1
                    if self._max_frames is not None and emitted >= self._max_frames:
                        break
                index += 1
        finally:
            cap.release()
