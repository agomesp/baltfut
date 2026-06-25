import numpy as np

from balltrack.tracking import BallTracker


def feed(tracker, observations):
    return [tracker.update(o) for o in observations]


def err(pred, gt):
    return float(np.hypot(pred[0] - gt[0], pred[1] - gt[1]))


def test_no_track_before_first_observation():
    est = BallTracker().update(None)
    assert est.lost
    assert est.position is None


def test_first_observation_initializes_at_that_point():
    est = BallTracker().update((10.0, 20.0))
    assert est.observed
    assert not est.lost
    np.testing.assert_allclose(est.position, [10.0, 20.0], atol=1e-6)


def test_smoothing_reduces_noise_on_constant_velocity_track():
    rng = np.random.default_rng(0)
    truth = [(i * 1.0, i * 0.5) for i in range(40)]
    noisy = [(x + rng.normal(0, 0.5), y + rng.normal(0, 0.5)) for x, y in truth]
    ests = feed(BallTracker(measurement_noise=0.5, process_noise=0.05), noisy)
    # Over the warmed-up back half, the filter should beat the raw detections.
    filt_err = np.mean([err(e.position, g) for e, g in zip(ests[20:], truth[20:])])
    raw_err = np.mean([err(n, g) for n, g in zip(noisy[20:], truth[20:])])
    assert filt_err < raw_err


def test_velocity_converges_to_truth():
    truth = [(i * 2.0, i * -1.0) for i in range(30)]
    ests = feed(BallTracker(measurement_noise=0.1, process_noise=0.01), truth)
    np.testing.assert_allclose(ests[-1].velocity, [2.0, -1.0], atol=0.1)


def test_predicts_through_a_gap():
    t = BallTracker(measurement_noise=0.1, process_noise=0.01)
    feed(t, [(i * 1.0, 0.0) for i in range(10)])  # x advances ~1/frame, y~0
    e1, e2, e3 = t.update(None), t.update(None), t.update(None)
    assert not e1.observed and not e2.observed and not e3.observed
    assert e1.position[0] > 9.0          # kept moving forward
    assert e3.position[0] > e1.position[0]
    assert abs(e3.position[1]) < 0.5     # stayed on the line


def test_rejects_an_impossible_jump():
    t = BallTracker(measurement_noise=0.1, process_noise=0.01)
    feed(t, [(i * 1.0, 0.0) for i in range(15)])  # stable track along x
    before = t.update((15.0, 0.0))     # consistent point
    outlier = t.update((15.0, 60.0))   # 60 m off the trajectory — impossible
    assert before.observed
    assert not outlier.observed         # gated out
    assert abs(outlier.position[1]) < 5.0  # estimate not yanked to the outlier


def test_track_marked_lost_after_too_many_missed():
    t = BallTracker(max_missed=3, measurement_noise=0.1, process_noise=0.01)
    feed(t, [(i * 1.0, 0.0) for i in range(5)])
    last = None
    for _ in range(4):
        last = t.update(None)
    assert last.lost
