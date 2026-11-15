# Submission drafts — Earth Jukebox

Drafts in English for the NASA Space Apps Challenge 2026 project form,
challenge **"The Earth Information Jukebox"**, team **Sagitta** (FR10.2).
Owners: Danna Vergara (product and deliverables) with Andres Navarro Marin.

> **Status: DRAFT.** Lines marked `TODO` are still open. Before submitting,
> check every claim against what the final app actually does, and paste the
> final text into the form. Deadline: Sunday 15 November, target 10:00 p.m.,
> internal limit 11:50 p.m. (Colombia time).

## Links

| Field | Value | Check |
|---|---|---|
| Demo link | TODO: public link to the 30-second video, no login | [ ] Opens in a private window |
| Project link | https://github.com/Betha2516/Nasa-Challenge | [ ] Repository is **public** · [ ] Opens in a private window |

The app itself is not published on the internet: it runs locally (see the
repository README).

## High-level summary

TODO (Danna): final wording, about 100–150 words.

> Earth Jukebox turns NASA Earth science data into music you can explore. It
> opens on a 3D planet; each data layer has its own voice, generated live in
> the browser: forest height measured by GEDI sets the notes and harmony,
> wildfire smoke makes the sound rougher and darker, carbon dioxide sets a
> breathing pulse and lightning adds percussion. Moving over the planet or focusing on the Amazon — where the
> planet flattens into a detailed regional map — lets you hear how the forest,
> the smoke that threatens it and the CO2 around it change from place to place
> and over time. The story it tells: the Amazon as the lungs of the world, how
> it works, why it matters and what affects it.

## Project details

### What it does

TODO: confirm against the final app.

- A 3D planet with four NASA layers: forest height (GEDI), wildfire smoke
  (GEOS-CF), carbon dioxide (DYAMOND) and lightning (LIS on the ISS).
- Each layer sounds in real time where the cursor is. The layers never mix:
  only the layer picked in the layer picker is heard.
- A short welcome tour explains the controls the first time the app opens.
- Focusing on the Amazon turns the planet and flattens it into a regional map.
- A static timeline: the person picks the moment with the Time slider; a
  story mode walks through the three ideas in under a minute.
- Keyboard-only use and screen-reader descriptions (layer, place, low / medium
  / high value).

### How it works

- The NASA data is turned ahead of time, by Python and Rust tools, into grids
  of values from 0 to 1:
  - **forest height** is the canopy height measured by GEDI, on a fixed scale
    of 0 to 50 m (NASA SVS 4950 fills the gaps where GEDI has no measurement);
  - **wildfire smoke** is surface PM2.5 from the GEOS-CF model, on a fixed
    scale of 0 to 150 µg/m³;
  - **CO2** and **lightning** are relative values read from the colours of
    NASA visualizations (an intensity and a frequency), not physical
    measurements.
- The browser interpolates those grids in space (and in time for smoke and
  CO2) and maps each value to sound with the Web Audio API: pitch within a
  five-note scale, roughness and filter, breathing rate, percussion for
  lightning, stereo position and volume.
- The interface is React with three.js for the planet and GSAP for the
  transition. A small Rust (Axum) server serves everything from the laptop, so
  the whole demo runs **without internet**, packaged in Docker.
- CO2 is global but a mosaic: NASA only publishes it as a turning globe, so only
  the Americas and the Atlantic move with the timeline (23 to 25 February 2020)
  and the rest of the planet is a fixed picture, each region on the date of the
  view that covers it. It is presented as global context, not as a measured
  effect of what happens in the Amazon.

### Benefits

TODO (Danna): final wording.

- Makes Earth science data perceivable by ear, not only by eye, including for
  people who are blind or have low vision.
- Gives the general public an intuitive, memorable way into NASA data about the
  Amazon.

### What we hope to achieve

TODO (Danna).

### Tools, languages and hardware

- Languages: TypeScript, Rust, Python
- Interface: React, Tailwind CSS, three.js with react-three-fiber, GSAP, driver.js (welcome tour), Vite
- Sound: Web Audio API
- Data download and conversion: Python (NumPy, pyproj, tifffile, Pillow); ffmpeg to extract video frames
- Data preparation: Rust
- Local server: Rust with Axum and Tokio
- Tests: Vitest, cargo test
- Packaging: Docker, Docker Compose
- Hardware: a laptop with stereo audio output

## Use of artificial intelligence

TODO: the whole team confirms this is complete and accurate (FR10.4).

> We used AI tools while building this project. TODO: name the tools and what
> each was used for (for example, generating and reviewing code, tests and
> documentation, and planning the work), and who reviewed the output. No image,
> video or sound in the project is AI-generated. TODO: if any is, say which and
> add a watermark to it.

The repository states the same in its README (FR10.4).

## NASA data

| Layer | Source | Link |
|---|---|---|
| Forest height | GEDI L3 Gridded Land Surface Metrics V3, mean canopy height (NASA GEDI, ORNL DAAC), April 2019 – July 2025; gaps filled with GEDI Forest Height, NASA SVS 4950 | https://doi.org/10.3334/ORNLDAAC/2525 · https://svs.gsfc.nasa.gov/4950 |
| Wildfire smoke | GEOS-CF v2 analysis, surface PM2.5 (NASA GMAO), 1 September 2026, 24 hourly means | https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/ |
| Carbon dioxide | DYAMOND Global Carbon Dioxide, NASA SVS 5196, 23 – 25 February 2020 | https://svs.gsfc.nasa.gov/5196 |
| Lightning | Lightning Events Detected from the ISS 2017-2023, NASA SVS 5011 | https://svs.gsfc.nasa.gov/5011 |
| Base image of the planet | Natural Earth I with Shaded Relief and Water (public domain; backdrop only, no data values) | https://www.naturalearthdata.com/downloads/10m-raster-data/10m-natural-earth-1/ |

How each source becomes a value, and the limits of each method, are in
[`data/SOURCES.md`](../data/SOURCES.md).

## References

TODO (Andres David): complete the list of data and references for the form.

- NASA Earth Information Center: TODO link
- NASA Scientific Visualization Studio: https://svs.gsfc.nasa.gov/
- The SVS visualizations listed under "NASA data" above.
- Open-source libraries listed under "Tools, languages and hardware".

## Before pressing "Submit for Judging"

- [ ] Video is 30 seconds or less, narrated in English, public and without login
- [ ] Every link tested in a private browser window
- [ ] Repository public, README in English with how to run the local demo
- [ ] AI use declared here and in the README
- [ ] Every `TODO` in this file resolved
