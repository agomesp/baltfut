import math

import cv2
import numpy as np
import pytest

from balltrack.detection import BallDetection, FakeDetector
from balltrack.pipeline import BallPipeline
from balltrack.pitch import Pitch, PitchMapper
from balltrack.sink import MemorySink
from balltrack.source import VideoFileSource
from balltrack.tracking import BallTracker


def make_video(path, n_frames, fps, size=(64, 48)):
    w, h = size
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (w, h))
    assert writer.isOpened(), "could not open a VideoWriter (codec missing?)"
    for i in range(n_frames):
        writer.write(np.full((h, w, 3), (i * 8) % 256, dtype=np.uint8))
    writer.release()


def test_reads_frames_with_shape_and_timestamps(tmp_path):
    path = tmp_path / "clip.avi"
    make_video(path, n_frames=10, fps=20)
    frames = list(VideoFileSource(path))
    assert len(frames) == 10
    t0, img0 = frames[0]
    assert img0.shape == (48, 64, 3)
    assert img0.dtype == np.uint8
    times = [t for t, _ in frames]
    np.testing.assert_allclose(times, [i / 20.0 for i in range(10)], atol=0.01)


def test_target_fps_downsamples(tmp_path):
    path = tmp_path / "clip.avi"
    make_video(path, n_frames=30, fps=30)
    actual = len(list(VideoFileSource(path)))
    sampled = list(VideoFileSource(path, target_fps=10))  # 30 -> 10 fps, stride 3
    assert len(sampled) == math.ceil(actual / 3)
    # Timestamps reflect the real time of each kept frame (every 3rd).
    np.testing.assert_allclose([t for t, _ in sampled][:5], [0.0, 0.1, 0.2, 0.3, 0.4], atol=0.01)


def test_max_frames_caps_output(tmp_path):
    path = tmp_path / "clip.avi"
    make_video(path, n_frames=20, fps=30)
    assert len(list(VideoFileSource(path, max_frames=5))) == 5


def test_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        VideoFileSource(tmp_path / "nope.avi")


def test_real_source_feeds_the_pipeline(tmp_path):
    path = tmp_path / "clip.avi"
    make_video(path, n_frames=6, fps=10)
    expected_n = len(list(VideoFileSource(path)))
    pitch = Pitch()
    mapper = PitchMapper.from_correspondences(pitch.corners * 10.0, pitch.corners)
    script = [[BallDetection(center=(100, 340), confidence=0.9)] for _ in range(expected_n)]
    sink = MemorySink()
    n = BallPipeline(
        detector=FakeDetector(script), mapper=mapper, tracker=BallTracker(), sink=sink
    ).run(VideoFileSource(path))
    assert n == expected_n
    assert [s.frame for s in sink.samples] == list(range(expected_n))
