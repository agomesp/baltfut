import numpy as np
import pytest

from balltrack.pitch import Pitch, PitchMapper


def test_pitch_defaults_are_fifa_standard():
    pitch = Pitch()
    assert pitch.length == 105.0
    assert pitch.width == 68.0


def test_normalize_centre_is_half():
    np.testing.assert_allclose(Pitch().normalize([52.5, 34.0]), [0.5, 0.5])


def test_mapper_scaling_homography_round_trips_centre():
    # Image is the pitch scaled x10: 1 metre == 10 px, origin aligned.
    pitch = Pitch()
    mapper = PitchMapper.from_correspondences(pitch.corners * 10.0, pitch.corners)
    out = mapper.image_to_pitch([525.0, 340.0])
    np.testing.assert_allclose(out[0], [52.5, 34.0], atol=1e-6)


def test_mapper_maps_each_corner_to_its_pitch_corner():
    pitch = Pitch()
    img_corners = pitch.corners * 10.0
    mapper = PitchMapper.from_correspondences(img_corners, pitch.corners)
    np.testing.assert_allclose(mapper.image_to_pitch(img_corners), pitch.corners, atol=1e-6)


def test_mapper_handles_a_genuine_perspective():
    # Broadcast-like: the far touchline appears narrower than the near one
    # (a trapezoid in the image maps to the rectangular pitch).
    pitch = Pitch()
    img = np.array(
        [
            [100.0, 50.0],    # -> (0, 0)
            [900.0, 50.0],    # -> (105, 0)
            [1000.0, 500.0],  # -> (105, 68)
            [0.0, 500.0],     # -> (0, 68)
        ]
    )
    mapper = PitchMapper.from_correspondences(img, pitch.corners)
    # Corners land exactly; lines stay straight, so the top edge maps onto y=0.
    np.testing.assert_allclose(mapper.image_to_pitch(img), pitch.corners, atol=1e-6)
    top_mid = mapper.image_to_pitch([500.0, 50.0])[0]
    assert abs(top_mid[1]) < 1e-6
    assert 0.0 <= top_mid[0] <= pitch.length


def test_from_correspondences_rejects_too_few_points():
    with pytest.raises(ValueError):
        PitchMapper.from_correspondences([[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [1, 1]])
