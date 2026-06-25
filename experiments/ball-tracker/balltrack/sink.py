"""Output sinks for the ball timeline (the bridge that later becomes Supabase).

A sink consumes per-frame timeline records. `MemorySink` is for tests; `JsonlSink`
writes a replayable `.jsonl` the baltfut 2D field can load. A SupabaseSink that
publishes to a *local* Realtime channel comes later — same interface, swapped at
the edge, never touching prod.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import List, Optional, Protocol, Tuple, Union

Point = Tuple[float, float]


@dataclass(frozen=True)
class BallSample:
    frame: int  # frame index
    t: float  # timestamp, seconds
    position: Optional[Point]  # pitch metres (x, y); None when there is no track
    observed: bool  # a detection was accepted this frame
    lost: bool  # the track is currently lost


class Sink(Protocol):
    def emit(self, sample: BallSample) -> None:
        ...

    def close(self) -> None:
        ...


class MemorySink:
    """Collects samples in memory — for tests and quick inspection."""

    def __init__(self) -> None:
        self.samples: List[BallSample] = []

    def emit(self, sample: BallSample) -> None:
        self.samples.append(sample)

    def close(self) -> None:
        pass


class JsonlSink:
    """Writes one JSON object per line: a compact, replayable timeline."""

    def __init__(self, path: Union[str, Path]) -> None:
        self._path = Path(path)
        self._fh = None

    def emit(self, sample: BallSample) -> None:
        if self._fh is None:
            self._fh = self._path.open("w")
        self._fh.write(json.dumps(asdict(sample)) + "\n")

    def close(self) -> None:
        if self._fh is not None:
            self._fh.close()
            self._fh = None
