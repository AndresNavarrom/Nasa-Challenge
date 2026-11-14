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

> Earth Jukebox turns NASA Earth Information Center visualizations into music
> you can explore. It opens on a 3D planet; each data layer has its own voice,
> generated live in the browser: forest height sets the notes and harmony,
> wildfire smoke makes the sound rougher and darker, and carbon dioxide sets a
> breathing pulse. Moving over the planet or focusing on the Amazon — where the
> planet flattens into a detailed regional map — lets you hear how the forest,
> the smoke that threatens it and the CO2 around it change from place to place
> and over time. The story it tells: the Amazon as the lungs of the world, how
> it works, why it matters and what affects it.

## Project details

### What it does

TODO: confirm against the final app.

- A 3D planet with three NASA layers: forest height (GEDI), wildfire smoke
  (GEOS-CF) and carbon dioxide (DYAMOND).
- Each layer sounds in real time where the cursor is; the layers can be turned
  on and off and heard together.
- Focusing on the Amazon turns the planet and flattens it into a regional map.
- A shared timeline plays the data like a song; a story mode walks through the
  three ideas in under a minute.
- Keyboard-only use and screen-reader descriptions (layer, place, low / medium
  / high value).

### How it works

- The NASA Scientific Visualization Studio frames are converted ahead of time,
  by a Rust tool, into grids of **relative intensities from 0 to 1**, read from
  each visualization's colour bar or, where there is none, from the pixel's
  colour. These are relative intensities, not physical measurements.
- The browser interpolates those grids in space (and in time for smoke and
  CO2) and maps each value to sound with the Web Audio API: pitch within a
  five-note scale, roughness and filter, breathing rate, stereo position and
  volume.
- The interface is React with three.js for the planet and GSAP for the
  transition. A small Rust (Axum) server serves everything from the laptop, so
  the whole demo runs **without internet**, packaged in Docker.
- Smoke and CO2 only have usable data over the Amazon, so on the planet they
  are seen and heard over that region only. CO2 is presented as global context,
  not as a measured effect of what happens in the Amazon.

### Benefits

TODO (Danna): final wording.

- Makes Earth science data perceivable by ear, not only by eye, including for
  people who are blind or have low vision.
- Gives the general public an intuitive, memorable way into NASA data about the
  Amazon.

### What we hope to achieve

TODO (Danna).

### Tools, languages and hardware

- Languages: TypeScript, Rust
- Interface: React, Tailwind CSS, three.js with react-three-fiber, GSAP, Vite
- Sound: Web Audio API
- Data preparation: Rust; ffmpeg to extract video frames
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

| Layer | NASA source | Link |
|---|---|---|
| Forest height | GEDI Forest Height (data April 2019 – April 2020), NASA SVS 4950 | https://svs.gsfc.nasa.gov/4950 |
| Wildfire smoke | Air Quality Model Runs, GEOS-CF (July – August 2024), NASA SVS 5533, Earth Information Center hyperwall version | https://svs.gsfc.nasa.gov/5533 |
| Carbon dioxide | DYAMOND Global Carbon Dioxide (January – March 2020), NASA SVS 5196 | https://svs.gsfc.nasa.gov/5196 |
| Base image of the planet | Equirectangular Projected Earth, NASA SVS 3615 (backdrop only, no data values) | https://svs.gsfc.nasa.gov/3615 |

How each frame becomes a value, and the limits of that method, are in
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
