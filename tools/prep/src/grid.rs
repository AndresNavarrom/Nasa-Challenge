//! Reduction of a value raster to a low-resolution intensity grid (FR1.4).

use crate::error::{PrepError, Result};

/// Smallest grids the requirements accept (FR1.4).
pub const MIN_GLOBAL: (u32, u32) = (72, 36);
pub const MIN_REGION: (u32, u32) = (32, 32);

/// Rejects images that cannot produce a grid of at least `min` cells.
pub fn check_image_size(name: &str, width: u32, height: u32, min: (u32, u32)) -> Result<()> {
    if width == 0 || height == 0 {
        return Err(PrepError::new(format!(
            "{name}: the image is empty ({width} x {height} pixels)"
        )));
    }
    if width < min.0 || height < min.1 {
        return Err(PrepError::new(format!(
            "{name}: the image is {width} x {height} pixels, smaller than the {} x {} grid it must fill",
            min.0, min.1
        )));
    }
    Ok(())
}

/// Averages a `src_width` x `src_height` raster down to `grid_width` x `grid_height` cells.
///
/// `NaN` marks "no data" in the source and is left out of the average; a cell with
/// no data at all becomes 0. Fails when the sizes do not match the buffer or the
/// source is smaller than the grid.
pub fn reduce_to_grid(
    src: &[f32],
    src_width: u32,
    src_height: u32,
    grid_width: u32,
    grid_height: u32,
) -> Result<Vec<f32>> {
    if grid_width == 0 || grid_height == 0 {
        return Err(PrepError::new("the grid must have at least one cell per side"));
    }
    check_image_size("value raster", src_width, src_height, (grid_width, grid_height))?;
    let expected = src_width as usize * src_height as usize;
    if src.len() != expected {
        return Err(PrepError::new(format!(
            "value raster has {} values but {src_width} x {src_height} needs {expected}",
            src.len()
        )));
    }

    let mut grid = Vec::with_capacity(grid_width as usize * grid_height as usize);
    for cell_y in 0..grid_height {
        let (y0, y1) = cell_span(cell_y, grid_height, src_height);
        for cell_x in 0..grid_width {
            let (x0, x1) = cell_span(cell_x, grid_width, src_width);
            let mut sum = 0.0f64;
            let mut count = 0u32;
            for y in y0..y1 {
                let row = y as usize * src_width as usize;
                for x in x0..x1 {
                    let value = src[row + x as usize];
                    if !value.is_nan() {
                        sum += value as f64;
                        count += 1;
                    }
                }
            }
            grid.push(if count == 0 { 0.0 } else { (sum / count as f64) as f32 });
        }
    }
    Ok(grid)
}

/// Source pixel range `[start, end)` covered by one grid cell; never empty.
fn cell_span(cell: u32, cells: u32, pixels: u32) -> (u32, u32) {
    let start = (cell as u64 * pixels as u64 / cells as u64) as u32;
    let end = ((cell as u64 + 1) * pixels as u64 / cells as u64) as u32;
    (start, end.max(start + 1).min(pixels))
}

/// 0..1 values -> one byte per cell (the app divides by 255).
pub fn quantize(values: &[f32]) -> Vec<u8> {
    values
        .iter()
        .map(|v| if v.is_nan() { 0 } else { (v.clamp(0.0, 1.0) * 255.0).round() as u8 })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reduces_a_raster_to_the_requested_grid_size() {
        // 4 x 4 raster whose left half is 0.2 and right half is 0.8, with one hole.
        let mut raster = vec![0.2, 0.2, 0.8, 0.8].repeat(4);
        raster[0] = f32::NAN;

        let grid = reduce_to_grid(&raster, 4, 4, 2, 2).expect("valid sizes");

        assert_eq!(grid.len(), 4);
        for (cell, expected) in grid.iter().zip([0.2, 0.8, 0.2, 0.8]) {
            assert!((cell - expected).abs() < 1e-6, "cell {cell} != {expected}");
        }
        assert_eq!(quantize(&grid), vec![51, 204, 51, 204]);

        // A cell made only of holes is 0, not NaN.
        let empty = reduce_to_grid(&[f32::NAN; 4], 2, 2, 1, 1).expect("valid sizes");
        assert_eq!(empty, vec![0.0]);
    }

    #[test]
    fn rejects_images_with_an_invalid_size() {
        // Empty image.
        assert!(check_image_size("frame.png", 0, 10, MIN_REGION).is_err());
        // Smaller than the grid it must fill.
        let too_small = check_image_size("frame.png", 40, 20, MIN_GLOBAL).unwrap_err();
        assert!(too_small.to_string().contains("frame.png"), "{too_small}");
        assert!(reduce_to_grid(&[0.5; 4], 2, 2, 4, 4).is_err());
        // Buffer length that does not match the declared size.
        assert!(reduce_to_grid(&[0.5; 5], 2, 2, 1, 1).is_err());
        // A valid size passes.
        assert!(check_image_size("frame.png", 72, 36, MIN_GLOBAL).is_ok());
    }
}
