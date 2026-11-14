//! Frames -> value rasters -> grids, textures and manifest.json.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use image::{imageops::FilterType, DynamicImage, RgbImage, RgbaImage};

use crate::color::{brightness_value, colorbar_value, stretch_brightness, warmth_value, Rgb};
use crate::config::{
    BBox, ColorbarImage, GridOut, GridSizes, LayerConfig, LayerOut, Manifest, PrepConfig, RegionOut,
    ValueConfig, ViewConfig,
};
use crate::error::{PrepError, Result};
use crate::grid::{check_image_size, quantize, reduce_to_grid, MIN_REGION};

/// Each grid cell is averaged from SUPERSAMPLE x SUPERSAMPLE samples of the frame.
const SUPERSAMPLE: u32 = 4;
const GLOBAL_TEXTURE: (u32, u32) = (1024, 512);
const REGION_TEXTURE_WIDTH: u32 = 512;
const EARTH_TEXTURE: (u32, u32) = (2048, 1024);

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

/// Resizes the base image of the planet and stores it as `earth.jpg`.
fn prepare_earth(file: &str, raw_dir: &Path, out_dir: &Path) -> Result<()> {
    let path = raw_dir.join(file);
    let image = load_rgb(&path)?;
    check_image_size(file, image.width(), image.height(), (512, 256))?;
    let resized = image::imageops::resize(&image, EARTH_TEXTURE.0, EARTH_TEXTURE.1, FilterType::Triangle);
    let target = out_dir.join("earth.jpg");
    DynamicImage::ImageRgb8(resized)
        .save(&target)
        .map_err(|cause| PrepError::new(format!("could not write {}: {cause}", target.display())))
}

/// Runs the whole preparation described by `config`.
pub fn run(config: &PrepConfig, raw_dir: &Path, out_dir: &Path) -> Result<Manifest> {
    config.validate()?;
    ensure_dir(out_dir)?;
    if let Some(earth) = &config.earth {
        prepare_earth(&earth.file, raw_dir, out_dir)?;
        println!("  earth.jpg written");
    }
    let mut layers = Vec::with_capacity(config.layers.len());
    for layer in &config.layers {
        layers.push(prepare_layer(layer, config.bbox, config.grid, raw_dir, out_dir)?);
    }
    let manifest = Manifest { layers, region: RegionOut { bbox: config.bbox } };
    write_manifest(out_dir, &manifest)?;
    Ok(manifest)
}
