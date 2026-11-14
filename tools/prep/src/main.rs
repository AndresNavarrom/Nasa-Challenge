//! jukebox-prep: turns NASA SVS visualization frames into the intensity grids,
//! textures and manifest.json that the Earth Jukebox web app loads.
//!
//! The values are relative intensities read from the colours of rendered frames
//! (colour bar position, or brightness when there is no bar). They are not
//! physical measurements.

mod color;
mod config;
mod error;
mod grid;
mod pipeline;
mod project;
mod sample;

use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use config::{BBox, GridSizes, Manifest, PrepConfig};
use error::{PrepError, Result};

const USAGE: &str = "\
jukebox-prep: prepare the Earth Jukebox data

USAGE (run from the repository root):
  jukebox-prep --sample [--out DIR]
  jukebox-prep --config FILE [--raw DIR] [--out DIR]

OPTIONS:
  --sample        write generated sample data (flagged as sample in the manifest)
  --config FILE   JSON file listing the frames of each layer (see data/prep-config.json)
  --raw DIR       folder holding the downloaded frames   [default: data/raw]
  --out DIR       folder for grids, textures and manifest [default: web/public/data]
  -h, --help      show this help
";

struct Args {
    sample: bool,
    config: Option<PathBuf>,
    raw: PathBuf,
    out: PathBuf,
}

fn parse_args(raw_args: &[String]) -> Result<Option<Args>> {
    let mut args = Args {
        sample: false,
        config: None,
        raw: PathBuf::from("data/raw"),
        out: PathBuf::from("web/public/data"),
    };
    let mut iter = raw_args.iter();
    while let Some(arg) = iter.next() {
        let mut path_value = |name: &str| -> Result<PathBuf> {
            iter.next()
                .filter(|value| !value.is_empty() && !value.starts_with("--"))
                .map(PathBuf::from)
                .ok_or_else(|| PrepError::new(format!("{name} needs a path after it")))
        };
        match arg.as_str() {
            "-h" | "--help" => return Ok(None),
            "--sample" => args.sample = true,
            "--config" => args.config = Some(path_value("--config")?),
            "--raw" => args.raw = path_value("--raw")?,
            "--out" => args.out = path_value("--out")?,
            other => return Err(PrepError::new(format!("unknown option \"{other}\""))),
        }
    }
    if args.sample == args.config.is_some() {
        return Err(PrepError::new("choose exactly one of --sample or --config FILE"));
    }
    Ok(Some(args))
}

fn read_config(path: &Path) -> Result<PrepConfig> {
    let text = fs::read_to_string(path)
        .map_err(|cause| PrepError::new(format!("could not read {}: {cause}", path.display())))?;
    serde_json::from_str(&text)
        .map_err(|cause| PrepError::new(format!("{} is not a valid configuration: {cause}", path.display())))
}

fn run(args: &Args) -> Result<Manifest> {
    match &args.config {
        None => sample::run(&args.out, BBox::AMAZON, GridSizes::default()),
        Some(path) => {
            let config = read_config(path)?;
            if !args.raw.is_dir() {
                return Err(PrepError::new(format!(
                    "the raw data folder {} does not exist; run tools/fetch-frames.sh first",
                    args.raw.display()
                )));
            }
            pipeline::run(&config, &args.raw, &args.out)
        }
    }
}

fn main() -> ExitCode {
    let raw_args: Vec<String> = std::env::args().skip(1).collect();
    let args = match parse_args(&raw_args) {
        Ok(Some(args)) => args,
        Ok(None) => {
            print!("{USAGE}");
            return ExitCode::SUCCESS;
        }
        Err(error) => {
            eprintln!("jukebox-prep: {error}\n\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    match run(&args) {
        Ok(manifest) => {
            println!(
                "jukebox-prep: wrote {} layer(s) and manifest.json to {}",
                manifest.layers.len(),
                args.out.display()
            );
            for layer in &manifest.layers {
                println!(
                    "  {:<7} frames {:<3} global {:<9} region {}x{}{}",
                    layer.id,
                    layer.region.frames,
                    layer.global.as_ref().map_or("none".to_string(), |g| format!("{}x{}", g.width, g.height)),
                    layer.region.width,
                    layer.region.height,
                    if layer.sample { "  (sample data)" } else { "" }
                );
            }
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("jukebox-prep: {error}");
            ExitCode::FAILURE
        }
    }
}
