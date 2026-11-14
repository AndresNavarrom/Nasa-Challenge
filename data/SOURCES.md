# Data sources

Everything shown and heard in Earth Jukebox comes from visualizations published
by the NASA Scientific Visualization Studio (SVS) for the Earth Information
Center. This file is rewritten by `tools/fetch-frames.sh`.

## Important: what the values are

The values are **relative intensities (0 to 1) read from the colours of rendered
visualization frames**. They are not physical measurements and must not be read
as metres, micrograms or ppm. Georeferencing of the globe views was done by hand
(coastline landmarks) and is approximate, with errors of roughly 1 to 2 degrees.

## Layers

| Layer | NASA visualization | Frames used | View | How colour becomes a value |
|---|---|---|---|---|
| Forest height | [GEDI Forest Height, SVS 4950](https://svs.gsfc.nasa.gov/4950) (data April 2019 - April 2020) | 14 frames of the rotating-globe video | Global mosaic and Amazon detail | Position on the published colour bar (0 to 50 m) |
| Wildfire smoke | [Air Quality Model Runs, SVS 5533](https://svs.gsfc.nasa.gov/5533) (GEOS-CF, July - August 2024), Earth Information Center hyperwall version | 6 frames of the flat-map video | **Amazon only** | Darkness of the PM2.5 colour (pale = clean, dark = smoky) |
| Global CO2 | [DYAMOND Global Carbon Dioxide, SVS 5196](https://svs.gsfc.nasa.gov/5196) (January - March 2020) | 12 frames of the orbiting-globe video, 23 - 25 Feb 2020, every 6 hours | **Amazon only** | "Warmth" of the pixel (red minus blue), which rises along the published colour bar (cream, orange, red) and with the opacity of the gas |

## Fallbacks applied (see the risk table in the requirements)

- **No .exr files** are published for these visualizations; png, jpg and mp4 frames were used.
- **Smoke has no single flat global view of one pollutant.** The published map
  shows four pollutants in vertical stripes that sweep across a fixed map. Only
  the moments when the Amazon rectangle sits entirely inside the PM2.5 stripe
  were used, so the layer is regional only. The video carries no date stamp, so
  each instant is labelled with the period (July - August 2024) and its clip time.
- **CO2 has no flat global view.** The camera orbits a rendered globe, so only
  the frames where South America faces the camera were used; the layer is
  regional only and covers 23 to 25 February 2020 in six-hour steps (dates
  worked out from the stamp in the frames: one model hour per video frame).
  Brightness in this visualization also depends on the viewing angle through
  the gas, which adds to the uncertainty. The gas is drawn semi-transparent, so
  its colours on screen are darker than the published colour bar; the bar
  position could not be read directly and the red-minus-blue "warmth" is used
  instead. In these frames the Amazon is brightest at 06:00 and 12:00 UTC (night
  and early morning there) and dimmest at 18:00 UTC (early afternoon there), on
  all three days.
- **Forest height is a mosaic** of 14 views of a rotating globe rendered with
  lighting and exaggerated height, so shading affects the colours.
- On the planet, the two regional-only layers are drawn and heard over the
  Amazon rectangle only.

## Amazon rectangle

West 80 W, east 44 W, south 20 S, north 8 N.

## Base image of the planet

Cloud-free flat map of the Earth from "Equirectangular Projected Earth for
LARGEST", NASA Scientific Visualization Studio, SVS 3615:
<https://svs.gsfc.nasa.gov/3615>. It is only the backdrop of the planet and the
map; it carries no data values.

## Files

| File | Link | How it was obtained |
|---|---|---|
| `data/raw/4950/GEDI_global_w_colorbar_1080p60.mp4` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | downloaded as published |
| `data/raw/4950/GEDI_colorbar_0to50_01_print.jpg` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_colorbar_0to50_01_print.jpg> | downloaded as published |
| `data/raw/4950/gedi_globe_3.3.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 3.3 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_6.9.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 6.9 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_10.5.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 10.5 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_14.1.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 14.1 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_17.7.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 17.7 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_21.3.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 21.3 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_24.9.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 24.9 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_28.5.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 28.5 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_32.1.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 32.1 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_35.7.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 35.7 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_39.3.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 39.3 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_42.9.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 42.9 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_46.5.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 46.5 s, extracted with ffmpeg |
| `data/raw/4950/gedi_globe_50.1.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a004900/a004950/GEDI_global_w_colorbar_1080p60.mp4> | video frame at 50.1 s, extracted with ffmpeg |
| `data/raw/5533/eic_airquality_0.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005533/EIC_AirQuality_Preview_3840x1080.mp4> | video frame at 0 s, scaled to 1920 x 540 with ffmpeg |
| `data/raw/5533/eic_airquality_4.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005533/EIC_AirQuality_Preview_3840x1080.mp4> | video frame at 4 s, scaled to 1920 x 540 with ffmpeg |
| `data/raw/5533/eic_airquality_53.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005533/EIC_AirQuality_Preview_3840x1080.mp4> | video frame at 53 s, scaled to 1920 x 540 with ffmpeg |
| `data/raw/5533/eic_airquality_57.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005533/EIC_AirQuality_Preview_3840x1080.mp4> | video frame at 57 s, scaled to 1920 x 540 with ffmpeg |
| `data/raw/5533/eic_airquality_61.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005533/EIC_AirQuality_Preview_3840x1080.mp4> | video frame at 61 s, scaled to 1920 x 540 with ffmpeg |
| `data/raw/5533/eic_airquality_65.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005533/EIC_AirQuality_Preview_3840x1080.mp4> | video frame at 65 s, scaled to 1920 x 540 with ffmpeg |
| `data/raw/5196/dyamond_co2_globe_orbit_1080p30_h265.mp4` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | downloaded as published |
| `data/raw/5196/dyamondCbar_6-27-2024a.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondCbar_6-27-2024a.png> | downloaded as published |
| `data/raw/5196/co2_globe_31.3.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 31.3 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_31.5.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 31.5 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_31.7.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 31.7 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_31.9.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 31.9 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_32.1.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 32.1 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_32.3.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 32.3 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_32.5.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 32.5 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_32.7.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 32.7 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_32.9.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 32.9 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_33.1.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 33.1 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_33.3.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 33.3 s, extracted with ffmpeg |
| `data/raw/5196/co2_globe_33.5.png` | <https://svs.gsfc.nasa.gov/vis/a000000/a005100/a005196/dyamondPointCloud_12-1-2023b_dyamond_co2_anim_globe_orbit_1080p30_h265.mp4> | video frame at 33.5 s, extracted with ffmpeg |
| `data/raw/earth/earth_noClouds.0330.jpg` | <https://svs.gsfc.nasa.gov/vis/a000000/a003600/a003615/earth_noClouds.0330.jpg> | downloaded as published |

