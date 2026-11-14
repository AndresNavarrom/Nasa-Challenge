//! Colour -> relative intensity (FR1.4).
//!
//! The NASA frames encode the data in colour. When the visualization has a
//! colour bar we find where a pixel sits along that bar; otherwise we use the
//! pixel brightness. Both give *relative* intensities in 0..1, not physical
//! measurements.

pub type Rgb = [u8; 3];

/// Position of `rgb` along the colour bar, from 0.0 (first stop) to 1.0 (last stop).
///
/// The bar is treated as a polyline through `stops` in RGB space and the pixel is
/// projected onto the closest segment. Returns `None` when the bar has fewer than
/// two stops or the pixel is farther than `max_distance` (RGB units) from the bar,
/// which is how ocean, space and labels are rejected as "no data".
pub fn colorbar_value(rgb: Rgb, stops: &[Rgb], max_distance: f32) -> Option<f32> {
    if stops.len() < 2 {
        return None;
    }
    let pixel = to_f32(rgb);
    let segments = (stops.len() - 1) as f32;
    let mut best: Option<(f32, f32)> = None; // (squared distance, position)
    for (index, pair) in stops.windows(2).enumerate() {
        let start = to_f32(pair[0]);
        let end = to_f32(pair[1]);
        let axis = sub(end, start);
        let length_sq = dot(axis, axis);
        let t = if length_sq <= f32::EPSILON {
            0.0
        } else {
            (dot(sub(pixel, start), axis) / length_sq).clamp(0.0, 1.0)
        };
        let closest = [start[0] + axis[0] * t, start[1] + axis[1] * t, start[2] + axis[2] * t];
        let offset = sub(pixel, closest);
        let distance_sq = dot(offset, offset);
        if best.is_none_or(|(d, _)| distance_sq < d) {
            best = Some((distance_sq, (index as f32 + t) / segments));
        }
    }
    best.and_then(|(distance_sq, position)| {
        (distance_sq.sqrt() <= max_distance).then_some(position.clamp(0.0, 1.0))
    })
}

/// Perceived brightness of a pixel in 0..1 (Rec. 709 luma). Fallback when there is no colour bar.
pub fn brightness_value(rgb: Rgb) -> f32 {
    let [r, g, b] = to_f32(rgb);
    ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0).clamp(0.0, 1.0)
}

/// "Warmth" of a pixel in 0..1: red minus blue.
///
/// For visualizations drawn as a semi-transparent gas over a dark planet with a
/// cream -> orange -> red colour bar (DYAMOND CO2), the colours on screen are darker
/// than the bar, so the bar position cannot be read directly. Red minus blue rises
/// along that bar and with the opacity of the gas, and is zero for grey land, white
/// snow and black space.
pub fn warmth_value(rgb: Rgb) -> f32 {
    ((rgb[0] as f32 - rgb[2] as f32) / 255.0).clamp(0.0, 1.0)
}

/// Stretches a brightness so that `low` maps to 0 and `high` maps to 1; `invert` flips it
/// for visualizations where darker means more (for example smoke drawn on a pale map).
pub fn stretch_brightness(brightness: f32, low: f32, high: f32, invert: bool) -> f32 {
    let span = (high - low).max(f32::EPSILON);
    let value = ((brightness - low) / span).clamp(0.0, 1.0);
    if invert {
        1.0 - value
    } else {
        value
    }
}

fn to_f32(rgb: Rgb) -> [f32; 3] {
    [rgb[0] as f32, rgb[1] as f32, rgb[2] as f32]
}

fn sub(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

fn dot(a: [f32; 3], b: [f32; 3]) -> f32 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

#[cfg(test)]
mod tests {
    use super::*;

    const BROWN: Rgb = [90, 60, 30];
    const GREEN: Rgb = [40, 160, 40];
    const WHITE: Rgb = [250, 250, 240];

    #[test]
    fn colorbar_maps_colour_to_its_position_on_the_bar() {
        let stops = [BROWN, GREEN, WHITE];

        // Exact stops land on 0, 0.5 and 1.
        assert_eq!(colorbar_value(BROWN, &stops, 30.0), Some(0.0));
        assert_eq!(colorbar_value(GREEN, &stops, 30.0), Some(0.5));
        assert_eq!(colorbar_value(WHITE, &stops, 30.0), Some(1.0));

        // A colour halfway between brown and green sits a quarter of the way along.
        let halfway = colorbar_value([65, 110, 35], &stops, 30.0).expect("on the bar");
        assert!((halfway - 0.25).abs() < 0.01, "got {halfway}");

        // Ocean blue is far from the bar: no data. So is a bar with a single stop.
        assert_eq!(colorbar_value([20, 60, 200], &stops, 30.0), None);
        assert_eq!(colorbar_value(GREEN, &[GREEN], 30.0), None);
    }

    #[test]
    fn brightness_is_the_fallback_when_there_is_no_colour_bar() {
        assert_eq!(brightness_value([0, 0, 0]), 0.0);
        assert!((brightness_value([255, 255, 255]) - 1.0).abs() < 1e-5);

        // Green contributes more to perceived brightness than blue.
        assert!(brightness_value([0, 200, 0]) > brightness_value([0, 0, 200]));

        // Stretching clamps out-of-range input and can be inverted.
        assert_eq!(stretch_brightness(0.9, 0.2, 0.6, false), 1.0);
        assert_eq!(stretch_brightness(0.1, 0.2, 0.6, false), 0.0);
        assert!((stretch_brightness(0.4, 0.2, 0.6, true) - 0.5).abs() < 1e-5);

        // Warmth ignores grey and white, and grows from tan to orange to red.
        assert_eq!(warmth_value([150, 150, 150]), 0.0);
        assert_eq!(warmth_value([255, 255, 255]), 0.0);
        assert!(warmth_value([214, 182, 115]) < warmth_value([234, 131, 49]));
        assert!(warmth_value([234, 131, 49]) < warmth_value([230, 22, 8]));
    }
}
