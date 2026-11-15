//! Input configuration (which frames feed which layer) and the output manifest format.

use serde::{Deserialize, Serialize};

use crate::color::Rgb;
use crate::error::{PrepError, Result};
use crate::grid::{MIN_GLOBAL, MIN_REGION};
use crate::project::Projection;

/// Layer ids the app accepts; keep in step with `LAYER_IDS` in web/src/data/types.ts.
/// `co2` stays accepted although the data file no longer lists it.
pub const LAYER_IDS: [&str; 4] = ["forest", "smoke", "co2", "lightning"];

/// Largest grid side, in cells (FR2.1: at least 1440).
pub const MAX_GRID_SIDE: u32 = 2048;

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
        if self.global.iter().chain(self.region.iter()).any(|side| *side > MAX_GRID_SIDE) {
            return Err(PrepError::new(format!("grid sides must not exceed {MAX_GRID_SIDE} cells")));
        }
        Ok(())
    }
}

/// Grid sizes of one layer; each side given here replaces the general `grid` (FR3).
#[derive(Debug, Clone, Copy, Default, Deserialize)]
pub struct LayerGridSizes {
    #[serde(default)]
    pub global: Option<[u32; 2]>,
    #[serde(default)]
    pub region: Option<[u32; 2]>,
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

/// Base image of the planet (FR1): one flat latitude/longitude map of the whole Earth.
#[derive(Debug, Clone, Deserialize)]
pub struct EarthConfig {
    /// Path relative to the raw data folder.
    pub file: String,
    /// Sizes `[width, height]` written for the app, each as `earth-<width/1024>k.jpg` (FR1.1).
    #[serde(default = "default_earth_sizes")]
    pub sizes: Vec<[u32; 2]>,
    /// Output name of the crop of `bbox` at the source's own resolution (FR1.3); none when absent.
    #[serde(default)]
    pub region_file: Option<String>,
}

fn default_earth_sizes() -> Vec<[u32; 2]> {
    vec![[8192, 4096], [4096, 2048]]
}

/// Largest base image side: WebGL textures above this are not usable.
pub const MAX_EARTH_SIDE: u32 = 16384;

impl EarthConfig {
    pub fn validate(&self) -> Result<()> {
        if self.sizes.is_empty() {
            return Err(PrepError::new("earth: \"sizes\" lists no size"));
        }
        for [width, height] in &self.sizes {
            if *width < 512 || *height < 256 || *width > MAX_EARTH_SIDE || *height > MAX_EARTH_SIDE {
                return Err(PrepError::new(format!(
                    "earth: size {width} x {height} must be between 512 x 256 and {MAX_EARTH_SIDE} pixels per side"
                )));
            }
        }
        if let Some(name) = &self.region_file {
            let plain = !name.is_empty() && !name.contains(['/', '\\']) && !name.starts_with('.');
            if !plain || !name.ends_with(".jpg") {
                return Err(PrepError::new(format!(
                    "earth: \"region_file\" must be a plain .jpg file name, got \"{name}\""
                )));
            }
        }
        Ok(())
    }

    /// File name the app loads for a base image of `width` pixels.
    pub fn size_file_name(width: u32) -> String {
        if width % 1024 == 0 {
            format!("earth-{}k.jpg", width / 1024)
        } else {
            format!("earth-{width}.jpg")
        }
    }
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
    /// Grid sizes for this layer only; missing sides use the general `grid`.
    #[serde(default)]
    pub grid: Option<LayerGridSizes>,
    /// How far apart the instants are, as an ISO 8601 duration (`PT1H`, `P1M`). The
    /// app spaces the timeline marks and paces the playback with it. Layers that
    /// change over time need it together with a `time` on every instant.
    #[serde(default)]
    pub cadence: Option<String>,
    pub value: ValueConfig,
    pub instants: Vec<InstantConfig>,
}

fn yes() -> bool {
    true
}

impl LayerConfig {
    /// The grid sizes this layer is prepared at: its own `grid` where given, else `general`.
    pub fn grid_sizes(&self, general: GridSizes) -> GridSizes {
        let own = self.grid.unwrap_or_default();
        GridSizes {
            global: own.global.unwrap_or(general.global),
            region: own.region.unwrap_or(general.region),
        }
    }
}

/// One moment in time, built from one or more frames (several globe views are blended).
#[derive(Debug, Clone, Deserialize)]
pub struct InstantConfig {
    pub date: String,
    /// Start of the instant in UTC, ISO 8601 (`2026-09-01T00:30:00Z`); the app places
    /// the instant on the timeline with it. Required, with `cadence`, on every
    /// instant of a layer that changes over time.
    #[serde(default)]
    pub time: Option<String>,
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
    /// How this view's colours become values; the layer's `value` when absent.
    #[serde(default)]
    pub value: Option<ValueConfig>,
    /// A fallback view is only used where the main (non-fallback) views of the instant
    /// have no data, and is never blended with them (FR3).
    #[serde(default)]
    pub fallback: bool,
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

impl ValueConfig {
    /// Checks what can be checked without reading files (the colour bar image is read later).
    pub fn validate(&self) -> Result<()> {
        match self {
            ValueConfig::Brightness { low, high, .. } if high <= low => {
                Err(PrepError::new("brightness: \"high\" must be greater than \"low\""))
            }
            ValueConfig::Warmth { low, high } if high <= low => {
                Err(PrepError::new("warmth: \"high\" must be greater than \"low\""))
            }
            ValueConfig::Colorbar { stops, image: None, .. } if stops.len() < 2 => Err(PrepError::new(
                "colorbar: give at least two \"stops\" or an \"image\" of the colour bar",
            )),
            ValueConfig::Colorbar { image: Some(bar), .. } if bar.samples < 2 => {
                Err(PrepError::new("colorbar image: \"samples\" must be at least 2"))
            }
            _ => Ok(()),
        }
    }
}

/// True for `YYYY-MM-DDTHH:MM:SSZ`, the only time form the app reads.
fn is_utc_time(text: &str) -> bool {
    let bytes = text.as_bytes();
    let digit = |index: usize| bytes.get(index).is_some_and(u8::is_ascii_digit);
    bytes.len() == 20
        && [0, 1, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18].into_iter().all(digit)
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes[10] == b'T'
        && bytes[13] == b':'
        && bytes[16] == b':'
        && bytes[19] == b'Z'
}

/// True for the ISO 8601 durations the app reads: `PT<n>H` or `P<n>M` / `P<n>D`.
fn is_cadence(text: &str) -> bool {
    let (number, unit) = if let Some(rest) = text.strip_prefix("PT") {
        (rest.strip_suffix('H'), true)
    } else if let Some(rest) = text.strip_prefix('P') {
        (rest.strip_suffix('M').or_else(|| rest.strip_suffix('D')), true)
    } else {
        (None, false)
    };
    unit && number.is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()) && n != "0")
}

impl LayerConfig {
    /// A layer that changes over time names its `cadence` and gives every instant a
    /// `time`, in order; a static layer may leave both out.
    fn validate_times(&self) -> Result<()> {
        let named = |message: String| PrepError::new(format!("layer \"{}\": {message}", self.id));
        let timed = self.instants.iter().filter(|instant| instant.time.is_some()).count();
        if self.is_static && self.cadence.is_none() && timed == 0 {
            return Ok(());
        }
        let Some(cadence) = &self.cadence else {
            return Err(named("needs a \"cadence\" (ISO 8601, such as \"PT1H\" or \"P1M\")".into()));
        };
        if !is_cadence(cadence) {
            return Err(named(format!("cadence \"{cadence}\" must look like \"PT1H\", \"P1D\" or \"P1M\"")));
        }
        let mut previous: Option<&str> = None;
        for instant in &self.instants {
            let Some(time) = instant.time.as_deref() else {
                return Err(named(format!("instant \"{}\" has no \"time\"", instant.date)));
            };
            if !is_utc_time(time) {
                return Err(named(format!(
                    "instant \"{}\": time \"{time}\" must look like \"2026-09-01T00:30:00Z\"",
                    instant.date
                )));
            }
            if previous.is_some_and(|before| before >= time) {
                return Err(named(format!("instant \"{}\" is not later than the one before it", instant.date)));
            }
            previous = Some(time);
        }
        Ok(())
    }

    /// The layer's value method, each view's own method, and at least one main view per instant.
    fn validate_views(&self) -> Result<()> {
        let named = |cause: PrepError| PrepError::new(format!("layer \"{}\": {cause}", self.id));
        self.value.validate().map_err(named)?;
        for instant in &self.instants {
            if instant.views.iter().all(|view| view.fallback) {
                return Err(named(PrepError::new(format!(
                    "instant \"{}\" has only fallback views; at least one view must be a main view",
                    instant.date
                ))));
            }
            for view in &instant.views {
                if let Some(value) = &view.value {
                    value
                        .validate()
                        .map_err(|cause| named(PrepError::new(format!("view {}: {cause}", view.file))))?;
                }
            }
        }
        Ok(())
    }
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
            layer
                .grid_sizes(self.grid)
                .validate()
                .map_err(|cause| PrepError::new(format!("layer \"{}\": {cause}", layer.id)))?;
            layer.validate_views()?;
            layer.validate_times()?;
        }
        if let Some(earth) = &self.earth {
            earth.validate()?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A one-layer configuration with the given general `grid` and layer `grid` (JSON text or "null").
    fn config_with(grid: &str, layer_grid: &str) -> PrepConfig {
        let text = format!(
            r#"{{
              "grid": {grid},
              "layers": [{{
                "id": "lightning", "title": "Lightning", "description": "Test layer",
                "source": {{ "title": "SVS 5011", "url": "https://svs.gsfc.nasa.gov/5011" }},
                "static": true,
                "grid": {layer_grid},
                "value": {{ "method": "brightness" }},
                "instants": [{{ "date": "2017 - 2023 (accumulated)", "views": [{{
                  "file": "5011/lightning_2017_2023.png",
                  "projection": {{ "type": "equirect", "west": -180, "south": -90, "east": 180, "north": 90 }}
                }}] }}]
              }}]
            }}"#
        );
        serde_json::from_str(&text).expect("test configuration parses")
    }

    #[test]
    fn accepts_grids_of_1440_by_720_and_rejects_sides_above_the_cap() {
        let fine = config_with(r#"{ "global": [1440, 720], "region": [360, 280] }"#, "null");
        assert!(fine.validate().is_ok(), "{:?}", fine.validate());

        let too_wide = config_with(r#"{ "global": [2049, 720], "region": [360, 280] }"#, "null");
        let error = too_wide.validate().unwrap_err();
        assert!(error.to_string().contains("2048"), "{error}");

        // The cap applies to the region grid too, and the minimum still holds.
        assert!(config_with(r#"{ "global": [1440, 720], "region": [360, 2049] }"#, "null").validate().is_err());
        assert!(config_with(r#"{ "global": [71, 36] }"#, "null").validate().is_err());
    }

    #[test]
    fn a_layer_grid_replaces_the_general_grid_side_by_side() {
        let config = config_with(r#"{ "global": [1440, 720], "region": [144, 112] }"#, r#"{ "region": [360, 280] }"#);
        assert!(config.validate().is_ok(), "{:?}", config.validate());

        let sizes = config.layers[0].grid_sizes(config.grid);
        assert_eq!(sizes.region, [360, 280]); // the layer's own region grid
        assert_eq!(sizes.global, [1440, 720]); // the general global grid, not given by the layer

        // Without a layer grid, the general one is used.
        let plain = config_with(r#"{ "global": [1440, 720], "region": [144, 112] }"#, "null");
        assert_eq!(plain.layers[0].grid_sizes(plain.grid).region, [144, 112]);

        // A layer grid is checked with the same limits, naming the layer.
        let bad = config_with(r#"{ "global": [1440, 720] }"#, r#"{ "region": [4096, 280] }"#);
        let error = bad.validate().unwrap_err();
        assert!(error.to_string().contains("lightning"), "{error}");
    }

    /// A forest-like layer: a main equirect view, plus one fallback view with the given `value` (JSON).
    fn config_with_fallback_view(fallback_value: &str) -> serde_json::Result<PrepConfig> {
        let text = format!(
            r#"{{
              "grid": {{ "global": [1440, 720], "region": [360, 280] }},
              "layers": [{{
                "id": "forest", "title": "Forest height", "description": "Test layer",
                "source": {{ "title": "GEDI L3", "url": "https://doi.org/10.3334/ORNLDAAC/2525" }},
                "static": true,
                "value": {{ "method": "brightness", "low": 0, "high": 1 }},
                "instants": [{{ "date": "Apr 2019 - Jul 2025", "views": [
                  {{ "file": "gedi/gedi_l3_rh100_mean_0p1deg.png",
                     "projection": {{ "type": "equirect", "west": -180, "south": -90, "east": 180, "north": 90 }} }},
                  {{ "file": "4950/4k/GEDI_global.1711.png", "fallback": true, "value": {fallback_value},
                     "projection": {{ "type": "orthographic", "cx": 1920, "cy": 1080, "radius": 1040,
                                      "center_lon": -59.55, "center_lat": -0.38 }} }}
                ] }}]
              }}]
            }}"#
        );
        serde_json::from_str(&text)
    }

    #[test]
    fn fallback_view_with_its_own_value_method_validates() {
        let colorbar = r#"{ "method": "colorbar", "stops": [[0, 0, 0], [255, 0, 0]], "max_distance": 60 }"#;
        let config = config_with_fallback_view(colorbar).expect("parses");
        assert!(config.validate().is_ok(), "{:?}", config.validate());
        let views = &config.layers[0].instants[0].views;
        assert!(!views[0].fallback && views[0].value.is_none(), "main view: layer method, not a fallback");
        assert!(views[1].fallback && matches!(views[1].value, Some(ValueConfig::Colorbar { .. })));

        // An unknown method name is rejected when the file is read.
        assert!(config_with_fallback_view(r#"{ "method": "rainbow" }"#).is_err());

        // A known method with impossible settings is rejected by validation, naming layer and view.
        let inverted = config_with_fallback_view(r#"{ "method": "brightness", "low": 0.5, "high": 0.2 }"#).unwrap();
        let error = inverted.validate().unwrap_err().to_string();
        assert!(error.contains("forest") && error.contains("GEDI_global.1711.png") && error.contains("high"), "{error}");

        // A colour bar with neither stops nor image is rejected too.
        let empty_bar = config_with_fallback_view(r#"{ "method": "colorbar" }"#).unwrap();
        assert!(empty_bar.validate().is_err());
    }

    #[test]
    fn lightning_and_co2_are_both_known_layer_ids() {
        assert!(LAYER_IDS.contains(&"lightning"));
        assert!(LAYER_IDS.contains(&"co2"));
        assert_eq!(EarthConfig::size_file_name(8192), "earth-8k.jpg");
        assert_eq!(EarthConfig::size_file_name(4096), "earth-4k.jpg");
    }

    /// A two-instant layer with the given cadence and instant times (JSON values or "null").
    fn timed_config(cadence: &str, first: &str, second: &str) -> PrepConfig {
        let view = r#"{ "file": "a.png", "projection": { "type": "equirect", "west": -180, "south": -90, "east": 180, "north": 90 } }"#;
        let text = format!(
            r#"{{ "layers": [{{
                "id": "smoke", "title": "Smoke", "description": "Test layer",
                "source": {{ "title": "GEOS-CF", "url": "https://example.org" }},
                "cadence": {cadence}, "value": {{ "method": "brightness" }},
                "instants": [
                  {{ "date": "first", "time": {first}, "views": [{view}] }},
                  {{ "date": "second", "time": {second}, "views": [{view}] }}
                ] }}] }}"#
        );
        serde_json::from_str(&text).expect("test configuration parses")
    }

    #[test]
    fn a_layer_that_changes_over_time_names_its_cadence_and_the_time_of_every_instant() {
        let fine = timed_config(r#""PT1H""#, r#""2026-09-01T00:30:00Z""#, r#""2026-09-01T01:30:00Z""#);
        assert!(fine.validate().is_ok(), "{:?}", fine.validate());
        assert!(timed_config(r#""P1M""#, r#""2017-01-01T00:00:00Z""#, r#""2017-02-01T00:00:00Z""#).validate().is_ok());

        let no_cadence = timed_config("null", r#""2026-09-01T00:30:00Z""#, r#""2026-09-01T01:30:00Z""#);
        assert!(no_cadence.validate().unwrap_err().to_string().contains("cadence"));
        let missing_time = timed_config(r#""PT1H""#, r#""2026-09-01T00:30:00Z""#, "null");
        assert!(missing_time.validate().unwrap_err().to_string().contains("no \"time\""));
        let out_of_order = timed_config(r#""PT1H""#, r#""2026-09-01T01:30:00Z""#, r#""2026-09-01T00:30:00Z""#);
        assert!(out_of_order.validate().unwrap_err().to_string().contains("not later"));
        let bad_time = timed_config(r#""PT1H""#, r#""Sep 1, 2026""#, r#""2026-09-01T01:30:00Z""#);
        assert!(bad_time.validate().unwrap_err().to_string().contains("must look like"));
        let bad_cadence = timed_config(r#""hourly""#, r#""2026-09-01T00:30:00Z""#, r#""2026-09-01T01:30:00Z""#);
        assert!(bad_cadence.validate().unwrap_err().to_string().contains("cadence"));
    }

    #[test]
    fn a_static_layer_needs_no_times() {
        let config = config_with(r#"{ "global": [1440, 720], "region": [360, 280] }"#, "null");
        assert!(config.validate().is_ok(), "{:?}", config.validate());
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
    /// Start of each instant in UTC (ISO 8601); empty when the layer gives none.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub times: Vec<String>,
    /// Spacing of the instants (ISO 8601 duration); absent for static layers.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cadence: Option<String>,
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
