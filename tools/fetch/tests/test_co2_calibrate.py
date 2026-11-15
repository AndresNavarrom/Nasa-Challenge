"""Tests for the SVS 5196 globe fit (co2_calibrate.py). Synthetic line images only: no NASA frame is read."""

import numpy as np
import pytest

from co2_calibrate import FIT_SCALE, frame_number, project, refine, score, steady_lon

CAMERA = {"cx": 400.0, "cy": 300.0, "radius": 200.0, "center_lon": -50.0, "center_lat": 0.0, "roll": 0.0, "distance": 4.6}


def test_point_under_the_camera_lands_on_the_disc_centre():
    x, y, z = project(np.array([[-50.0, 0.0]]), CAMERA)
    assert x[0] == pytest.approx(400.0) and y[0] == pytest.approx(300.0) and z[0] == pytest.approx(1.0)
    # North is up and east is right in the frame.
    _, y_north, _ = project(np.array([[-50.0, 20.0]]), CAMERA)
    x_east, _, _ = project(np.array([[-30.0, 0.0]]), CAMERA)
    assert y_north[0] < 300.0 and x_east[0] > 400.0


def test_far_side_of_the_globe_faces_away():
    _, _, z = project(np.array([[130.0, 0.0]]), CAMERA)
    assert z[0] < 0.0


def test_steady_turn_wraps_longitudes_and_frame_numbers_are_read():
    assert -180.0 <= steady_lon(1) < 180.0
    assert steady_lon(940) == pytest.approx(-49.90)
    assert frame_number("data/raw/5196/co2_orbit.00939.png") == 939
    with pytest.raises(SystemExit):
        frame_number("data/raw/5196/co2_globe_31.3.png")


def test_refine_recovers_a_shifted_longitude():
    # Coastline points on a ring of latitudes and longitudes around the camera.
    lon, lat = np.meshgrid(np.arange(-90.0, -10.0, 0.5), np.arange(-40.0, 41.0, 10.0))
    points = np.stack([lon.ravel(), lat.ravel()], axis=1)
    # Draw them where the true camera puts them, as bright lines on a dark frame.
    lines = np.zeros((600 // FIT_SCALE, 800 // FIT_SCALE), dtype=np.float32)
    x, y, z = project(points, CAMERA)
    keep = z > 0.3
    lines[(y[keep] / FIT_SCALE).astype(int), (x[keep] / FIT_SCALE).astype(int)] = 100.0
    start = dict(CAMERA, center_lon=-51.5)
    fitted = refine(lines, points, start, {"center_lon": 0.5}, rounds=5)
    assert fitted["center_lon"] == pytest.approx(-50.0, abs=0.2)
    assert fitted["score"] > score(lines, points, start)


def test_score_is_zero_when_almost_nothing_is_visible():
    lines = np.ones((300, 400), dtype=np.float32)
    assert score(lines, np.array([[-50.0, 0.0]]), CAMERA) == 0.0
