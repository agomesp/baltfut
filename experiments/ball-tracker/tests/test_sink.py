import json

from balltrack.sink import BallSample, JsonlSink, MemorySink


def sample(frame, t, pos, observed=True, lost=False):
    return BallSample(frame=frame, t=t, position=pos, observed=observed, lost=lost)


def test_memory_sink_collects_in_order():
    s = MemorySink()
    a = sample(0, 0.0, (1.0, 2.0))
    b = sample(1, 0.1, None, observed=False)
    s.emit(a)
    s.emit(b)
    s.close()
    assert s.samples == [a, b]


def test_jsonl_sink_writes_one_json_object_per_line(tmp_path):
    path = tmp_path / "timeline.jsonl"
    s = JsonlSink(path)
    s.emit(sample(0, 0.0, (10.5, 34.0)))
    s.emit(sample(1, 0.1, None, observed=False))
    s.close()
    lines = path.read_text().strip().splitlines()
    assert len(lines) == 2
    first = json.loads(lines[0])
    assert first["frame"] == 0
    assert first["t"] == 0.0
    assert first["position"] == [10.5, 34.0]
    assert first["observed"] is True
    second = json.loads(lines[1])
    assert second["position"] is None
    assert second["observed"] is False


def test_jsonl_sink_close_is_idempotent(tmp_path):
    s = JsonlSink(tmp_path / "t.jsonl")
    s.emit(sample(0, 0.0, (1.0, 1.0)))
    s.close()
    s.close()  # must not raise
