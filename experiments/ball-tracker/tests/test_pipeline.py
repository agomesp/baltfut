import numpy as np

from balltrack.detection import BallDetection, FakeDetector
from balltrack.pipeline import BallPipeline
from balltrack.pitch import Pitch, PitchMapper
from balltrack.sink import MemorySink
from balltrack.tracking import BallTracker


def scaling_mapper():
    # Image is the pitch scaled x10, so pixel -> pitch is divide-by-10.
    pitch = Pitch()
    return PitchMapper.from_correspondences(pitch.corners * 10.0, pitch.corners)


def one(x, y, conf=0.9):
    return [BallDetection(center=(x, y), confidence=conf)]


def make_pipe(script, sink):
    return BallPipeline(
        detector=FakeDetector(script),
        mapper=scaling_mapper(),
        tracker=BallTracker(measurement_noise=1.0, process_noise=0.1),
        sink=sink,
    )


def test_pipeline_emits_one_sample_per_frame_with_index_and_time():
    sink = MemorySink()
    n = make_pipe([one(100, 340), one(110, 340), one(120, 340)], sink).run(
        [(0.0, None), (0.1, None), (0.2, None)]
    )
    assert n == 3
    assert [s.frame for s in sink.samples] == [0, 1, 2]
    assert [round(s.t, 3) for s in sink.samples] == [0.0, 0.1, 0.2]
    # (100, 340) px -> (10, 34) m, and init lands exactly on the first detection.
    np.testing.assert_allclose(sink.samples[0].position, [10.0, 34.0], atol=1e-6)


def test_pipeline_predicts_through_a_gap_and_gates_an_outlier():
    script = [
        one(100, 340),  # f0 -> (10, 34)
        one(110, 340),  # f1 -> (11, 34)
        one(120, 340),  # f2 -> (12, 34)
        [],             # f3  gap (no detection)
        one(140, 340),  # f4 -> (14, 34)
        one(140, 900),  # f5 -> (14, 90)  impossible jump in y
        one(160, 340),  # f6 -> (16, 34)
        one(170, 340),  # f7 -> (17, 34)
    ]
    sink = MemorySink()
    make_pipe(script, sink).run([(i * 0.1, None) for i in range(len(script))])

    observed = [s.observed for s in sink.samples]
    assert observed[3] is False  # gap -> predicted, not observed
    assert observed[5] is False  # outlier -> gated out
    assert observed[0] and observed[2] and observed[4] and observed[7]
    # The gap frame still produced a forward-extrapolated point near the line.
    assert abs(sink.samples[3].position[1] - 34.0) < 3.0
    # The outlier did NOT yank the track toward y=90.
    assert sink.samples[5].position[1] < 50.0
    # The track recovers and ends near (17, 34).
    np.testing.assert_allclose(sink.samples[7].position, [17.0, 34.0], atol=3.0)
