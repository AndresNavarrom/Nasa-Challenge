//! Where a longitude/latitude falls inside a NASA frame.
//!
//! Two kinds of frames are supported:
//! - `equirect`: a flat latitude/longitude map (possibly a rectangle inside the frame);
//! - `orthographic`: a rendered globe seen from far away. The globe disc and the
//!   point under the camera are given by hand, so the georeferencing is approximate.

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Projection {
    Equirect {
        west: f64,
        south: f64,
        east: f64,
        north: f64,
        /// Pixel rectangle `[x, y, width, height]` holding the map; the whole frame when absent.
        #[serde(default)]
        rect: Option<[f64; 4]>,
    },
    Orthographic {
        /// Centre of the globe disc, in pixels.
        cx: f64,
        cy: f64,
        /// Radius of the globe disc, in pixels.
        radius: f64,
        /// Longitude and latitude at the centre of the disc, in degrees.
        center_lon: f64,
        center_lat: f64,
        /// Clockwise rotation of north in the frame, in degrees.
        #[serde(default)]
        roll: f64,
        /// Camera distance in globe radii; absent means "very far" (true orthographic).
        #[serde(default)]
        distance: Option<f64>,
        /// Points closer to the limb than this (cosine of the view angle) are ignored.
        #[serde(default = "default_min_weight")]
        min_weight: f64,
    },
}

fn default_min_weight() -> f64 {
    0.25
}

/// A pixel position plus how much to trust it (1 = facing the camera, 0 = at the limb).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PixelHit {
    pub x: f64,
    pub y: f64,
    pub weight: f64,
}

impl Projection {
    /// Pixel that shows `lon`/`lat` (degrees) in a frame of `width` x `height`, if visible.
    pub fn locate(&self, lon: f64, lat: f64, width: u32, height: u32) -> Option<PixelHit> {
        let hit = match self {
            Projection::Equirect { west, south, east, north, rect } => {
                let [rx, ry, rw, rh] = rect.unwrap_or([0.0, 0.0, width as f64, height as f64]);
                let span_lon = east - west;
                let span_lat = north - south;
                if span_lon <= 0.0 || span_lat <= 0.0 {
                    return None;
                }
                // Wrap the longitude into [west, west + 360).
                let wrapped = west + (lon - west).rem_euclid(360.0);
                let u = (wrapped - west) / span_lon;
                let v = (north - lat) / span_lat;
                if !(0.0..=1.0).contains(&u) || !(0.0..=1.0).contains(&v) {
                    return None;
                }
                PixelHit { x: rx + u * rw, y: ry + v * rh, weight: 1.0 }
            }
            Projection::Orthographic {
                cx,
                cy,
                radius,
                center_lon,
                center_lat,
                roll,
                distance,
                min_weight,
            } => {
                let phi = lat.to_radians();
                let phi0 = center_lat.to_radians();
                let delta = (lon - center_lon).to_radians();
                // Camera frame: x to the right, y up, z towards the camera.
                let x = phi.cos() * delta.sin();
                let y = phi0.cos() * phi.sin() - phi0.sin() * phi.cos() * delta.cos();
                let z = phi0.sin() * phi.sin() + phi0.cos() * phi.cos() * delta.cos();
                let (scale, visible_from) = match distance {
                    Some(d) if *d > 1.0 => ((d * d - 1.0).sqrt() / (d - z), 1.0 / d),
                    _ => (1.0, 0.0),
                };
                if z <= visible_from || z < *min_weight {
                    return None;
                }
                let (sin_roll, cos_roll) = roll.to_radians().sin_cos();
                let px = (x * cos_roll + y * sin_roll) * scale;
                let py = (-x * sin_roll + y * cos_roll) * scale;
                PixelHit { x: cx + radius * px, y: cy - radius * py, weight: z }
            }
        };
        let inside = hit.x >= 0.0 && hit.y >= 0.0 && hit.x < width as f64 && hit.y < height as f64;
        inside.then_some(hit)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn equirect_and_orthographic_place_known_points() {
        let map = Projection::Equirect { west: -180.0, south: -90.0, east: 180.0, north: 90.0, rect: None };
        let centre = map.locate(0.0, 0.0, 360, 180).expect("visible");
        assert!((centre.x - 180.0).abs() < 1e-9 && (centre.y - 90.0).abs() < 1e-9);

        let globe = Projection::Orthographic {
            cx: 100.0,
            cy: 100.0,
            radius: 50.0,
            center_lon: -60.0,
            center_lat: -5.0,
            roll: 0.0,
            distance: None,
            min_weight: 0.25,
        };
        let under_camera = globe.locate(-60.0, -5.0, 200, 200).expect("visible");
        assert!((under_camera.x - 100.0).abs() < 1e-6 && (under_camera.y - 100.0).abs() < 1e-6);
        assert!((under_camera.weight - 1.0).abs() < 1e-9);
        // North of the centre is higher in the frame; the far side of the globe is hidden.
        assert!(globe.locate(-60.0, 20.0, 200, 200).expect("visible").y < 100.0);
        assert_eq!(globe.locate(120.0, 5.0, 200, 200), None);
    }
}
