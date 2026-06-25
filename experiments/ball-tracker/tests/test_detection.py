from balltrack.detection import BallDetection, FakeDetector, select_ball


def det(x, y, conf):
    return BallDetection(center=(x, y), confidence=conf)


def test_select_ball_none_when_empty():
    assert select_ball([]) is None


def test_select_ball_picks_highest_confidence():
    assert select_ball([det(1, 1, 0.3), det(2, 2, 0.9), det(3, 3, 0.5)]) == (2, 2)


def test_select_ball_applies_min_confidence():
    assert select_ball([det(1, 1, 0.2), det(2, 2, 0.4)], min_confidence=0.5) is None
    assert select_ball([det(1, 1, 0.2), det(9, 9, 0.8)], min_confidence=0.5) == (9, 9)


def test_fake_detector_returns_scripted_then_empty():
    f = FakeDetector([[det(1, 1, 0.9)], [], [det(2, 2, 0.7), det(3, 3, 0.8)]])
    assert f.detect(None) == [det(1, 1, 0.9)]
    assert f.detect(None) == []
    assert f.detect(None) == [det(2, 2, 0.7), det(3, 3, 0.8)]
    assert f.detect(None) == []  # past the end of the script
