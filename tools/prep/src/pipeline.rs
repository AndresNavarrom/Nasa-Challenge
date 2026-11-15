//! Frames -> value rasters -> grids, textures and manifest.json.

use std::collections::HashMap;
use std::fs;
use std::io::BufWriter;
use std::path::{Path, PathBuf};

use image::{codecs::jpeg::JpegEncoder, imageops::FilterType, ImageReader, RgbImage, RgbaImage};

use crate::color::{brightness_value, colorbar_value, stretch_brightness, warmth_value, Rgb};
use crate::config::{
    BBox, ColorbarImage, EarthConfig, GridOut, GridSizes, LayerConfig, LayerOut, Manifest, PrepConfig,
    RegionOut, ValueConfig, ViewConfig,
};
use crate::error::{PrepError, Result};
use crate::grid::{check_image_size, quantize, reduce_to_grid, MIN_REGION};

/// Each grid cell is averaged from SUPERSAMPLE x SUPERSAMPLE samples of the frame.
const SUPERSAMPLE: u32 = 4;
const GLOBAL_TEXTURE: (u32, u32) = (1024, 512);
const REGION_TEXTURE_WIDTH: u32 = 512;
/// JPEG quality of the base images (FR1).
const EARTH_JPEG_QUALITY: u8 = 85;

/// Colour -> value rule with the colour bar already resolved to a list of stops.
pub enum ValueMethod {
    Colorbar { stops: Vec<Rgb>, max_distance: f32, fade: bool },
    Brightness { low: f32, high: f32, invert: bool },
    Warmth { low: f32, high: f32 },
}

impl ValueMethod {
    /// Value in 0..1, or `None` when the pixel carries no data.
    pub fn value(&self, rgb: Rgb) -> Option<f32> {
        match self {
            ValueMethod::Colorbar { stops, max_distance, .. } => colorbar_value(rgb, stops, *max_distance),
            ValueMethod::Brightness { low, high, invert } => {
                Some(stretch_brightness(brightness_value(rgb), *low, *high, *invert))
            }
            ValueMethod::Warmth { low, high } => {
                Some(stretch_brightness(warmth_value(rgb), *low, *high, false))
            }
        }
    }

    /// Opacity of a pixel in the layer texture.
    fn alpha(&self, value: f32) -> u8 {
        match self {
            // Colour-bar layers are opaque wherever there is data, unless asked to fade.
            ValueMethod::Colorbar { fade: false, .. } => 255,
            // Otherwise the layer fades out where the value is low, so the planet shows through.
            _ => (value.clamp(0.0, 1.0).sqrt() * 255.0).round() as u8,
        }
    }
}

struct LoadedView {
    image: RgbImage,
    view: ViewConfig,
}

/// Value raster (NaN = no data) and matching RGBA picture for one instant.
pub struct Rendered {
    pub values: Vec<f32>,
    pub picture: RgbaImage,
}

pub fn load_rgb(path: &Path) -> Result<RgbImage> {
    let image = image::open(path).map_err(|cause| {
        PrepError::new(format!("could not read the image {}: {cause}", path.display()))
    })?;
    Ok(image.to_rgb8())
}

fn resolve_method(value: &ValueConfig, raw_dir: &Path) -> Result<ValueMethod> {
    match value {
        ValueConfig::Brightness { low, high, invert } => {
            if high <= low {
                return Err(PrepError::new("brightness: \"high\" must be greater than \"low\""));
            }
            Ok(ValueMethod::Brightness { low: *low, high: *high, invert: *invert })
        }
        ValueConfig::Warmth { low, high } => {
            if high <= low {
                return Err(PrepError::new("warmth: \"high\" must be greater than \"low\""));
            }
            Ok(ValueMethod::Warmth { low: *low, high: *high })
        }
        ValueConfig::Colorbar { stops, image, max_distance, fade } => {
            // Listed stops come first (lowest values), then the colours read from the bar image.
            let mut stops = stops.clone();
            if let Some(bar) = image {
                stops.extend(read_colorbar(bar, raw_dir)?);
            }
            if stops.len() < 2 {
                return Err(PrepError::new(
                    "colorbar: give at least two \"stops\" or an \"image\" of the colour bar",
                ));
            }
            Ok(ValueMethod::Colorbar { stops, max_distance: *max_distance, fade: *fade })
        }
    }
}

/// Samples the colours of a colour bar along a straight line, low end first.
fn read_colorbar(bar: &ColorbarImage, raw_dir: &Path) -> Result<Vec<Rgb>> {
    let path = raw_dir.join(&bar.file);
    let image = load_rgb(&path)?;
    if bar.samples < 2 {
        return Err(PrepError::new("colorbar image: \"samples\" must be at least 2"));
    }
    let mut stops = Vec::with_capacity(bar.samples);
    for index in 0..bar.samples {
        let t = index as f64 / (bar.samples - 1) as f64;
        let x = (bar.from[0] as f64 + (bar.to[0] as f64 - bar.from[0] as f64) * t).round() as u32;
        let y = (bar.from[1] as f64 + (bar.to[1] as f64 - bar.from[1] as f64) * t).round() as u32;
        if x >= image.width() || y >= image.height() {
            return Err(PrepError::new(format!(
                "colour bar line leaves the image {} ({} x {}) at pixel {x},{y}",
                path.display(),
                image.width(),
                image.height()
            )));
        }
        stops.push(image.get_pixel(x, y).0);
    }
    Ok(stops)
}

fn is_masked(masks: &[[f64; 4]], x: f64, y: f64) -> bool {
    masks.iter().any(|[mx, my, mw, mh]| x >= *mx && y >= *my && x < mx + mw && y < my + mh)
}

/// Draws `area` at `width` x `height` by looking each point up in every view of the instant.
/// Views are blended by squared weight so the centre of a globe view wins over its limb.
fn render(views: &[LoadedView], method: &ValueMethod, area: BBox, width: u32, height: u32) -> Rendered {
    let mut values = vec![f32::NAN; width as usize * height as usize];
    let mut picture = RgbaImage::new(width, height);
    for row in 0..height {
        let lat = area.north - (row as f64 + 0.5) / height as f64 * (area.north - area.south);
        for column in 0..width {
            let lon = area.west + (column as f64 + 0.5) / width as f64 * (area.east - area.west);
            let mut weight_sum = 0.0f64;
            let mut value_sum = 0.0f64;
            let mut colour_sum = [0.0f64; 3];
            // The view that sees the point most directly decides whether there is data
            // at all: near the limb of a globe view, tall rendered relief hides what is
            // behind it and would otherwise paint land colours over the ocean.
            let mut best_weight = 0.0f64;
            let mut best_has_data = false;
            for loaded in views {
                let (image_width, image_height) = loaded.image.dimensions();
                let Some(hit) = loaded.view.projection.locate(lon, lat, image_width, image_height) else {
                    continue;
                };
                if is_masked(&loaded.view.masks, hit.x, hit.y) {
                    continue;
                }
                let rgb = loaded.image.get_pixel(hit.x as u32, hit.y as u32).0;
                let value = method.value(rgb);
                if hit.weight > best_weight {
                    best_weight = hit.weight;
                    best_has_data = value.is_some();
                }
                let Some(value) = value else { continue };
                let weight = hit.weight * hit.weight;
                weight_sum += weight;
                value_sum += value as f64 * weight;
                for channel in 0..3 {
                    colour_sum[channel] += rgb[channel] as f64 * weight;
                }
            }
            if best_has_data && weight_sum > 0.0 {
                let value = (value_sum / weight_sum) as f32;
                values[row as usize * width as usize + column as usize] = value;
                let colour = colour_sum.map(|sum| (sum / weight_sum).round() as u8);
                picture.put_pixel(
                    column,
                    row,
                    image::Rgba([colour[0], colour[1], colour[2], method.alpha(value)]),
                );
            }
        }
    }
    Rendered { values, picture }
}

fn region_texture_size(bbox: BBox) -> (u32, u32) {
    let aspect = (bbox.north - bbox.south) / (bbox.east - bbox.west);
    (REGION_TEXTURE_WIDTH, ((REGION_TEXTURE_WIDTH as f64 * aspect).round() as u32).max(MIN_REGION.1))
}

fn write_file(path: &Path, bytes: &[u8]) -> Result<()> {
    fs::write(path, bytes)
        .map_err(|cause| PrepError::new(format!("could not write {}: {cause}", path.display())))
}

fn save_picture(path: &Path, picture: &RgbaImage) -> Result<()> {
    picture
        .save(path)
        .map_err(|cause| PrepError::new(format!("could not write {}: {cause}", path.display())))
}

/// Grids of one layer for one area, ready to be written.
pub struct AreaOutput {
    pub width: u32,
    pub height: u32,
    /// One quantized grid per instant.
    pub frames: Vec<Vec<u8>>,
    pub texture: RgbaImage,
}

/// Writes `<id>_<suffix>.bin` and `<id>_<suffix>.png`; returns the manifest entry.
pub fn write_area(out_dir: &Path, id: &str, suffix: &str, area: &AreaOutput) -> Result<GridOut> {
    let cells = area.width as usize * area.height as usize;
    if area.frames.is_empty() || area.frames.iter().any(|frame| frame.len() != cells) {
        return Err(PrepError::new(format!(
            "layer \"{id}\" ({suffix}): every frame must have {} x {} = {cells} cells",
            area.width, area.height
        )));
    }
    let file = format!("{id}_{suffix}.bin");
    let texture = format!("{id}_{suffix}.png");
    write_file(&out_dir.join(&file), &area.frames.concat())?;
    save_picture(&out_dir.join(&texture), &area.texture)?;
    Ok(GridOut {
        width: area.width,
        height: area.height,
        frames: area.frames.len() as u32,
        file,
        texture,
    })
}

pub fn write_manifest(out_dir: &Path, manifest: &Manifest) -> Result<()> {
    let json = serde_json::to_string_pretty(manifest)
        .map_err(|cause| PrepError::new(format!("could not encode manifest.json: {cause}")))?;
    write_file(&out_dir.join("manifest.json"), json.as_bytes())
}

pub fn ensure_dir(dir: &Path) -> Result<()> {
    fs::create_dir_all(dir)
        .map_err(|cause| PrepError::new(format!("could not create {}: {cause}", dir.display())))
}

fn load_views(
    views: &[ViewConfig],
    raw_dir: &Path,
    cache: &mut HashMap<PathBuf, RgbImage>,
) -> Result<Vec<LoadedView>> {
    let mut loaded = Vec::with_capacity(views.len());
    for view in views {
        let path = raw_dir.join(&view.file);
        if !cache.contains_key(&path) {
            let image = load_rgb(&path)?;
            check_image_size(&view.file, image.width(), image.height(), MIN_REGION)?;
            cache.insert(path.clone(), image);
        }
        loaded.push(LoadedView { image: cache[&path].clone(), view: view.clone() });
    }
    Ok(loaded)
}

fn prepare_layer(
    layer: &LayerConfig,
    bbox: BBox,
    sizes: GridSizes,
    raw_dir: &Path,
    out_dir: &Path,
) -> Result<LayerOut> {
    let method = resolve_method(&layer.value, raw_dir)
        .map_err(|cause| PrepError::new(format!("layer \"{}\": {cause}", layer.id)))?;
    let [global_w, global_h] = sizes.global;
    let [region_w, region_h] = sizes.region;
    let mut cache = HashMap::new();
    let mut region_frames = Vec::new();
    let mut global_frames = Vec::new();
    let mut region_texture = None;
    let mut global_texture = None;

    for (index, instant) in layer.instants.iter().enumerate() {
        let views = load_views(&instant.views, raw_dir, &mut cache)?;
        let region = render(&views, &method, bbox, region_w * SUPERSAMPLE, region_h * SUPERSAMPLE);
        let covered = region.values.iter().filter(|v| !v.is_nan()).count();
        if covered == 0 {
            return Err(PrepError::new(format!(
                "layer \"{}\", instant \"{}\": no frame shows the Amazon rectangle; check the projection settings",
                layer.id, instant.date
            )));
        }
        region_frames.push(quantize(&reduce_to_grid(
            &region.values,
            region_w * SUPERSAMPLE,
            region_h * SUPERSAMPLE,
            region_w,
            region_h,
        )?));
        if layer.global {
            let global =
                render(&views, &method, BBox::WORLD, global_w * SUPERSAMPLE, global_h * SUPERSAMPLE);
            global_frames.push(quantize(&reduce_to_grid(
                &global.values,
                global_w * SUPERSAMPLE,
                global_h * SUPERSAMPLE,
                global_w,
                global_h,
            )?));
        }
        // Textures are drawn from the first instant only.
        if index == 0 {
            let (texture_w, texture_h) = region_texture_size(bbox);
            region_texture = Some(render(&views, &method, bbox, texture_w, texture_h).picture);
            if layer.global {
                global_texture = Some(
                    render(&views, &method, BBox::WORLD, GLOBAL_TEXTURE.0, GLOBAL_TEXTURE.1).picture,
                );
            }
        }
        println!(
            "  {} [{}] region coverage {:.0}%",
            layer.id,
            instant.date,
            covered as f64 * 100.0 / region.values.len() as f64
        );
    }

    let region_out = write_area(
        out_dir,
        &layer.id,
        "region",
        &AreaOutput {
            width: region_w,
            height: region_h,
            frames: region_frames,
            texture: region_texture.expect("validated: at least one instant"),
        },
    )?;
    let global_out = match global_texture {
        Some(texture) => Some(write_area(
            out_dir,
            &layer.id,
            "global",
            &AreaOutput { width: global_w, height: global_h, frames: global_frames, texture },
        )?),
        None => {
            remove_stale_global(out_dir, &layer.id)?;
            None
        }
    };

    Ok(LayerOut {
        id: layer.id.clone(),
        title: layer.title.clone(),
        description: layer.description.clone(),
        source: layer.source.clone(),
        is_static: layer.is_static,
        sample: false,
        dates: layer.instants.iter().map(|instant| instant.date.clone()).collect(),
        global: global_out,
        region: region_out,
    })
}

/// A region-only layer must not leave global files from an earlier run (for example
/// `--sample`) next to the new manifest.
fn remove_stale_global(out_dir: &Path, id: &str) -> Result<()> {
    for extension in ["bin", "png"] {
        let path = out_dir.join(format!("{id}_global.{extension}"));
        match fs::remove_file(&path) {
            Ok(()) => println!("  removed stale {}", path.display()),
            Err(cause) if cause.kind() == std::io::ErrorKind::NotFound => {}
            Err(cause) => {
                return Err(PrepError::new(format!("could not remove {}: {cause}", path.display())))
            }
        }
    }
    Ok(())
}

/// Pixel rectangle inside an image.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PixelRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Pixels of a whole-Earth flat map (`width` x `height`, west and north edge first) covered by `bbox`.
pub fn crop_rect(bbox: BBox, width: u32, height: u32) -> Result<PixelRect> {
    if bbox.west < -180.0 || bbox.east > 180.0 {
        return Err(PrepError::new(format!(
            "the rectangle crosses the 180 degree meridian (west {} east {}); the base image crop cannot wrap",
            bbox.west, bbox.east
        )));
    }
    let column = |lon: f64| ((lon + 180.0) / 360.0 * width as f64).round() as u32;
    let row = |lat: f64| ((90.0 - lat) / 180.0 * height as f64).round() as u32;
    let (x0, x1) = (column(bbox.west), column(bbox.east).min(width));
    let (y0, y1) = (row(bbox.north), row(bbox.south).min(height));
    if x1 <= x0 || y1 <= y0 {
        return Err(PrepError::new(format!(
            "the rectangle covers no pixel of a {width} x {height} image"
        )));
    }
    Ok(PixelRect { x: x0, y: y0, width: x1 - x0, height: y1 - y0 })
}

/// Opens a possibly very large image (the 21600 x 10800 Natural Earth TIFF is about
/// 700 MB decoded) without the decoder's default memory limit.
fn load_large_rgb(path: &Path) -> Result<RgbImage> {
    let fail = |cause: String| PrepError::new(format!("could not read the image {}: {cause}", path.display()));
    let mut reader = ImageReader::open(path)
        .map_err(|cause| fail(cause.to_string()))?
        .with_guessed_format()
        .map_err(|cause| fail(cause.to_string()))?;
    reader.no_limits();
    Ok(reader.decode().map_err(|cause| fail(cause.to_string()))?.into_rgb8())
}

fn save_jpeg(path: &Path, image: &RgbImage) -> Result<()> {
    let fail = |cause: String| PrepError::new(format!("could not write {}: {cause}", path.display()));
    let file = fs::File::create(path).map_err(|cause| fail(cause.to_string()))?;
    JpegEncoder::new_with_quality(BufWriter::new(file), EARTH_JPEG_QUALITY)
        .encode_image(image)
        .map_err(|cause| fail(cause.to_string()))
}

/// Writes the base image of the planet at every configured size, plus the crop of
/// `bbox` at the source's own resolution (FR1.1, FR1.3). `earth.jpg` is no longer written.
fn prepare_earth(earth: &EarthConfig, bbox: BBox, raw_dir: &Path, out_dir: &Path) -> Result<()> {
    let image = load_large_rgb(&raw_dir.join(&earth.file))?;
    check_image_size(&earth.file, image.width(), image.height(), (512, 256))?;
    println!("  earth source {} x {}", image.width(), image.height());
    if let Some(name) = &earth.region_file {
        let rect = crop_rect(bbox, image.width(), image.height())?;
        let crop = image::imageops::crop_imm(&image, rect.x, rect.y, rect.width, rect.height).to_image();
        save_jpeg(&out_dir.join(name), &crop)?;
        println!("  {name} written ({} x {})", rect.width, rect.height);
    }
    for [width, height] in &earth.sizes {
        let resized = image::imageops::resize(&image, *width, *height, FilterType::Triangle);
        let name = EarthConfig::size_file_name(*width);
        save_jpeg(&out_dir.join(&name), &resized)?;
        println!("  {name} written ({width} x {height})");
    }
    Ok(())
}

/// Runs the whole preparation described by `config`.
pub fn run(config: &PrepConfig, raw_dir: &Path, out_dir: &Path) -> Result<Manifest> {
    config.validate()?;
    ensure_dir(out_dir)?;
    if let Some(earth) = &config.earth {
        prepare_earth(earth, config.bbox, raw_dir, out_dir)?;
    }
    let mut layers = Vec::with_capacity(config.layers.len());
    for layer in &config.layers {
        let sizes = layer.grid_sizes(config.grid);
        layers.push(prepare_layer(layer, config.bbox, sizes, raw_dir, out_dir)?);
    }
    let manifest = Manifest { layers, region: RegionOut { bbox: config.bbox } };
    write_manifest(out_dir, &manifest)?;
    Ok(manifest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crop_rect_finds_the_amazon_in_the_natural_earth_image() {
        // Natural Earth 10m: 21600 x 10800 pixels, 1 arc-minute each.
        let rect = crop_rect(BBox::AMAZON, 21600, 10800).expect("inside the image");
        assert_eq!(rect, PixelRect { x: 6000, y: 4920, width: 2160, height: 1680 });

        // Same rectangle on the 4096 x 2048 base image: proportional, rounded to whole pixels.
        let small = crop_rect(BBox::AMAZON, 4096, 2048).expect("inside the image");
        assert_eq!((small.x, small.y, small.width, small.height), (1138, 933, 409, 319));
    }

    #[test]
    fn crop_rect_rejects_rectangles_it_cannot_cut() {
        // Across the 180 degree meridian.
        let pacific = BBox { west: 170.0, south: -10.0, east: 190.0, north: 10.0 };
        assert!(crop_rect(pacific, 21600, 10800).unwrap_err().to_string().contains("180"));
        // Narrower than one pixel of a tiny image.
        let sliver = BBox { west: 10.0, south: 0.0, east: 10.1, north: 0.1 };
        assert!(crop_rect(sliver, 360, 180).is_err());
    }
}
