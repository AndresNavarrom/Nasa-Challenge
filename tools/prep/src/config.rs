//! Input configuration (which frames feed which layer) and the output manifest format.

use serde::{Deserialize, Serialize};

use crate::color::Rgb;
use crate::error::{PrepError, Result};
use crate::grid::{MIN_GLOBAL, MIN_REGION};
use crate::project::Projection;

pub const LAYER_IDS: [&str; 3] = ["forest", "smoke", "co2"];

/// Latitude/longitude rectangle in degrees.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct BBox {
    pub west: f64,
    pub south: f64,
    pub east: f64,
    pub north: f64,
}

impl BBox {
    pub const WORLD: BBox = BBox { west: -180.0, south: -90.0, east: 180.0, north: 90.0 };
    /// Amazon rectangle used by the demo (fixed in block B0 of the work plan).
    pub const AMAZON: BBox = BBox { west: -80.0, south: -20.0, east: -44.0, north: 8.0 };

    pub fn validate(&self) -> Result<()> {
        let in_range = (-360.0..=360.0).contains(&self.west)
            && (-360.0..=360.0).contains(&self.east)
            && (-90.0..=90.0).contains(&self.south)
            && (-90.0..=90.0).contains(&self.north);
        if !in_range || self.west >= self.east || self.south >= self.north {
            return Err(PrepError::new(format!(
                "bbox is not a valid rectangle: west {} south {} east {} north {}",
                self.west, self.south, self.east, self.north
            )));
        }
        Ok(())
    }
}

/// Grid sizes as `[width, height]`.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct GridSizes {
    #[serde(default = "default_global_size")]
    pub global: [u32; 2],
    #[serde(default = "default_region_size")]
    pub region: [u32; 2],
}

fn default_global_size() -> [u32; 2] {
    [144, 72]
}

fn default_region_size() -> [u32; 2] {
    [96, 72]
}

impl Default for GridSizes {
    fn default() -> Self {
        GridSizes { global: default_global_size(), region: default_region_size() }
    }
}

impl GridSizes {
    pub fn validate(&self) -> Result<()> {
        if self.global[0] < MIN_GLOBAL.0 || self.global[1] < MIN_GLOBAL.1 {
            return Err(PrepError::new(format!(
                "global grid {} x {} is below the required minimum of {} x {}",
                self.global[0], self.global[1], MIN_GLOBAL.0, MIN_GLOBAL.1
            )));
        }
        if self.region[0] < MIN_REGION.0 || self.region[1] < MIN_REGION.1 {
            return Err(PrepError::new(format!(
                "region grid {} x {} is below the required minimum of {} x {}",
                self.region[0], self.region[1], MIN_REGION.0, MIN_REGION.1
            )));
        }
        const MAX_SIDE: u32 = 1024;
        if self.global.iter().chain(self.region.iter()).any(|side| *side > MAX_SIDE) {
            return Err(PrepError::new(format!("grid sides must not exceed {MAX_SIDE} cells")));
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct PrepConfig {
    #[serde(default = "default_bbox")]
    pub bbox: BBox,
    #[serde(default)]
    pub grid: GridSizes,
    /// Optional base image of the planet (flat latitude/longitude map of the whole Earth).
    #[serde(default)]
    pub earth: Option<EarthConfig>,
    pub layers: Vec<LayerConfig>,
}

fn default_bbox() -> BBox {
    BBox::AMAZON
}

#[derive(Debug, Clone, Deserialize)]
pub struct EarthConfig {
    pub file: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub title: String,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LayerConfig {
    pub id: String,
    pub title: String,
    pub description: String,
    pub source: Source,
    #[serde(rename = "static", default)]
    pub is_static: bool,
    /// False when the visualization has no usable flat global view (region-only layer).
    #[serde(default = "yes")]
    pub global: bool,
    pub value: ValueConfig,
    pub instants: Vec<InstantConfig>,
}

fn yes() -> bool {
    true
}

/// One moment in time, built from one or more frames (several globe views are blended).
#[derive(Debug, Clone, Deserialize)]
pub struct InstantConfig {
    pub date: String,
    pub views: Vec<ViewConfig>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ViewConfig {
    /// Path relative to the raw data folder.
    pub file: String,
    pub projection: Projection,
    /// Pixel rectangles `[x, y, width, height]` to ignore (labels, legends, date stamps).
    #[serde(default)]
    pub masks: Vec<[f64; 4]>,
}

/// How a pixel colour becomes a 0..1 value.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "method", rename_all = "lowercase")]
pub enum ValueConfig {
    Colorbar {
        /// Colours of the bar from low to high. When `image` is also given these come
        /// first (for the part of a bar that is transparent in the published image).
        #[serde(default)]
        stops: Vec<Rgb>,
        /// Read (more) stops from a colour bar image.
        #[serde(default)]
        image: Option<ColorbarImage>,
        #[serde(default = "default_max_distance")]
        max_distance: f32,
        /// Make the texture transparent where the value is low (for bars that start transparent).
        #[serde(default)]
        fade: bool,
    },
    Brightness {
        #[serde(default)]
        low: f32,
        #[serde(default = "one")]
        high: f32,
        #[serde(default)]
        invert: bool,
    },
    /// Red minus blue, stretched so `low` maps to 0 and `high` to 1 (see `color::warmth_value`).
    Warmth {
        #[serde(default)]
        low: f32,
        #[serde(default = "one")]
        high: f32,
    },
}

fn default_max_distance() -> f32 {
    60.0
}

fn one() -> f32 {
    1.0
}

/// A straight line across a colour bar image, sampled from its low end to its high end.
#[derive(Debug, Clone, Deserialize)]
pub struct ColorbarImage {
    pub file: String,
    pub from: [u32; 2],
    pub to: [u32; 2],
    #[serde(default = "default_samples")]
    pub samples: usize,
}

fn default_samples() -> usize {
    16
}

impl PrepConfig {
    pub fn validate(&self) -> Result<()> {
        self.bbox.validate()?;
        self.grid.validate()?;
        if self.layers.is_empty() {
            return Err(PrepError::new("the configuration lists no layers"));
        }
        let mut seen: Vec<&str> = Vec::new();
        for layer in &self.layers {
            if !LAYER_IDS.contains(&layer.id.as_str()) {
                return Err(PrepError::new(format!(
                    "layer id \"{}\" is not one of {}",
                    layer.id,
                    LAYER_IDS.join(", ")
                )));
            }
            if seen.contains(&layer.id.as_str()) {
                return Err(PrepError::new(format!("layer \"{}\" is listed twice", layer.id)));
            }
            seen.push(&layer.id);
            if layer.instants.is_empty() || layer.instants.iter().any(|i| i.views.is_empty()) {
                return Err(PrepError::new(format!(
                    "layer \"{}\" needs at least one instant and one frame per instant",
                    layer.id
                )));
            }
            if layer.is_static && layer.instants.len() != 1 {
                return Err(PrepError::new(format!(
                    "layer \"{}\" is static, so it must have exactly one instant",
                    layer.id
                )));
            }
        }
        Ok(())
    }
}

// ---- Output manifest (read by web/src/data/loadManifest.ts) ----

#[derive(Debug, Clone, Serialize)]
pub struct Manifest {
    pub layers: Vec<LayerOut>,
    pub region: RegionOut,
}

#[derive(Debug, Clone, Serialize)]
pub struct RegionOut {
    pub bbox: BBox,
}

#[derive(Debug, Clone, Serialize)]
pub struct LayerOut {
    pub id: String,
    pub title: String,
    pub description: String,
    pub source: Source,
    #[serde(rename = "static")]
    pub is_static: bool,
    /// True when the values are generated sample data rather than NASA frames.
    pub sample: bool,
    pub dates: Vec<String>,
    pub global: Option<GridOut>,
    pub region: GridOut,
}

#[derive(Debug, Clone, Serialize)]
pub struct GridOut {
    pub width: u32,
    pub height: u32,
    pub frames: u32,
    pub file: String,
    pub texture: String,
}
