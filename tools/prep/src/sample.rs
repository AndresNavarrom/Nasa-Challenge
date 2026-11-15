//! `--sample`: generated stand-in data so the interface and the sound can be built
//! before the real NASA frames are prepared. Every layer is flagged `sample: true`
//! in the manifest and the app shows a "sample data" badge.

use std::f64::consts::PI;
use std::path::Path;

use image::{Rgba, RgbaImage};

use crate::config::{BBox, GridSizes, LayerOut, Manifest, RegionOut, Source};
use crate::error::Result;
use crate::grid::quantize;
use crate::pipeline::{ensure_dir, write_area, write_manifest, AreaOutput};

const SAMPLE_FRAMES: usize = 6;

struct SampleLayer {
    id: &'static str,
    title: &'static str,
    description: &'static str,
    source_title: &'static str,
    source_url: &'static str,
    is_static: bool,
    /// Value in 0..1 at a longitude/latitude (degrees) and a time in 0..1.
    value: fn(f64, f64, f64) -> f64,
    /// Colour of the lowest and highest value in the texture.
    low: [u8; 3],
    high: [u8; 3],
}

fn bump(lon: f64, lat: f64, centre: (f64, f64), spread: (f64, f64)) -> f64 {
    let dx = (lon - centre.0) / spread.0;
    let dy = (lat - centre.1) / spread.1;
    (-(dx * dx + dy * dy) / 2.0).exp()
}

fn forest(lon: f64, lat: f64, _time: f64) -> f64 {
    let tropics = 0.95 * bump(lon, lat, (-62.0, -4.0), (14.0, 9.0))
        + 0.8 * bump(lon, lat, (22.0, -1.0), (10.0, 7.0))
        + 0.75 * bump(lon, lat, (112.0, 2.0), (14.0, 8.0));
    let boreal = 0.4 * (-((lat - 58.0) / 7.0).powi(2) / 2.0).exp();
    let texture = 0.05 * (lon * 0.9).to_radians().sin() * (lat * 1.3).to_radians().cos();
    (tropics + boreal + texture).clamp(0.0, 1.0)
}

fn smoke(lon: f64, lat: f64, time: f64) -> f64 {
    // A plume that grows and drifts north-west across the southern Amazon.
    let centre = (-52.0 - 14.0 * time, -12.0 + 6.0 * time);
    let spread = (6.0 + 6.0 * time, 4.0 + 4.0 * time);
    let amazon = (0.25 + 0.75 * time) * bump(lon, lat, centre, spread);
    let africa = 0.6 * bump(lon, lat, (20.0, -8.0), (12.0, 7.0));
    (amazon + africa).clamp(0.0, 1.0)
}

fn co2(lon: f64, lat: f64, time: f64) -> f64 {
    let northern = 1.0 / (1.0 + (-lat / 20.0).exp());
    let wave = (lon.to_radians() * 2.0 + 2.0 * PI * time).sin() * (lat.to_radians() * 1.5).cos();
    (0.3 + 0.3 * northern + 0.15 * wave + 0.15 * time).clamp(0.0, 1.0)
}

fn lightning(lon: f64, lat: f64, _time: f64) -> f64 {
    // Thunderstorm hot spots over tropical land: Congo basin, Lake Maracaibo and the
    // Amazon, the Maritime Continent; nothing beyond the reach of the ISS (about 55 degrees).
    if lat.abs() > 55.0 {
        return 0.0;
    }
    let hot_spots = 0.95 * bump(lon, lat, (25.0, -2.0), (10.0, 8.0))
        + 0.9 * bump(lon, lat, (-71.6, 9.8), (3.0, 3.0))
        + 0.55 * bump(lon, lat, (-60.0, -8.0), (14.0, 10.0))
        + 0.6 * bump(lon, lat, (110.0, 0.0), (15.0, 9.0));
    hot_spots.clamp(0.0, 1.0)
}

const LAYERS: [SampleLayer; 4] = [
    SampleLayer {
        id: "forest",
        title: "Forest height",
        description: "How tall the forest canopy is. Taller forest sounds as a higher, fuller note. \
                      Fixed base layer. SAMPLE DATA: generated values, not NASA data.",
        source_title: "GEDI Forest Height (NASA SVS 4950)",
        source_url: "https://svs.gsfc.nasa.gov/4950",
        is_static: true,
        value: forest,
        low: [84, 62, 34],
        high: [214, 245, 190],
    },
    SampleLayer {
        id: "smoke",
        title: "Wildfire smoke",
        description: "Smoke and air pollution from fires. More smoke makes the sound rougher and darker. \
                      SAMPLE DATA: generated values, not NASA data.",
        source_title: "Air Quality Model Runs (NASA SVS 5533)",
        source_url: "https://svs.gsfc.nasa.gov/5533",
        is_static: false,
        value: smoke,
        low: [255, 214, 140],
        high: [150, 20, 20],
    },
    SampleLayer {
        id: "co2",
        title: "Global CO2",
        description: "Carbon dioxide in the atmosphere, the global context. More CO2 makes the breathing \
                      pulse faster and heavier. SAMPLE DATA: generated values, not NASA data.",
        source_title: "DYAMOND Global Carbon Dioxide (NASA SVS 5196)",
        source_url: "https://svs.gsfc.nasa.gov/5196",
        is_static: false,
        value: co2,
        low: [40, 70, 120],
        high: [255, 196, 120],
    },
    SampleLayer {
        id: "lightning",
        title: "Lightning",
        description: "Where lightning strikes most often, seen from the International Space Station. \
                      Fixed layer. SAMPLE DATA: generated values, not NASA data.",
        source_title: "Lightning Events Detected from the ISS 2017-2023 (NASA SVS 5011)",
        source_url: "https://svs.gsfc.nasa.gov/5011",
        is_static: true,
        value: lightning,
        low: [20, 30, 80],
        high: [240, 245, 255],
    },
];

fn sample_area(layer: &SampleLayer, area: BBox, width: u32, height: u32, frames: usize) -> AreaOutput {
    let mut grids = Vec::with_capacity(frames);
    let mut texture = RgbaImage::new(width, height);
    for frame in 0..frames {
        let time = if frames > 1 { frame as f64 / (frames - 1) as f64 } else { 0.0 };
        let mut values = Vec::with_capacity(width as usize * height as usize);
        for row in 0..height {
            let lat = area.north - (row as f64 + 0.5) / height as f64 * (area.north - area.south);
            for column in 0..width {
                let lon = area.west + (column as f64 + 0.5) / width as f64 * (area.east - area.west);
                let value = (layer.value)(lon, lat, time) as f32;
                if frame == 0 {
                    let mix = |low: u8, high: u8| (low as f32 + (high as f32 - low as f32) * value) as u8;
                    let alpha = (value.sqrt() * 255.0) as u8;
                    texture.put_pixel(
                        column,
                        row,
                        Rgba([
                            mix(layer.low[0], layer.high[0]),
                            mix(layer.low[1], layer.high[1]),
                            mix(layer.low[2], layer.high[2]),
                            alpha,
                        ]),
                    );
                }
                values.push(value);
            }
        }
        grids.push(quantize(&values));
    }
    AreaOutput { width, height, frames: grids, texture }
}

/// Writes sample grids, textures and manifest.json into `out_dir`.
pub fn run(out_dir: &Path, bbox: BBox, sizes: GridSizes) -> Result<Manifest> {
    bbox.validate()?;
    sizes.validate()?;
    ensure_dir(out_dir)?;
    let mut layers = Vec::with_capacity(LAYERS.len());
    for layer in &LAYERS {
        let frames = if layer.is_static { 1 } else { SAMPLE_FRAMES };
        let global = sample_area(layer, BBox::WORLD, sizes.global[0], sizes.global[1], frames);
        let region = sample_area(layer, bbox, sizes.region[0], sizes.region[1], frames);
        let dates = if layer.is_static {
            vec!["Sample (fixed)".to_string()]
        } else {
            (1..=frames).map(|n| format!("Sample {n} of {frames}")).collect()
        };
        layers.push(LayerOut {
            id: layer.id.to_string(),
            title: layer.title.to_string(),
            description: layer.description.to_string(),
            source: Source { title: layer.source_title.to_string(), url: layer.source_url.to_string() },
            is_static: layer.is_static,
            sample: true,
            dates,
            global: Some(write_area(out_dir, layer.id, "global", &global)?),
            region: write_area(out_dir, layer.id, "region", &region)?,
        });
    }
    let manifest = Manifest { layers, region: RegionOut { bbox } };
    write_manifest(out_dir, &manifest)?;
    Ok(manifest)
}
