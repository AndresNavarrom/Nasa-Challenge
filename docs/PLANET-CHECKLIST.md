# Planet view — manual browser check

The 3D look, smoothness and timing cannot be checked by the unit tests. Run
this list in the browser on the demo laptop before the 11:00 p.m. decision.
Write the result (pass / fail and a note) next to each line.

## Setup

1. `docker compose up web` and open `http://127.0.0.1:5173/` in Chrome.
2. Open DevTools: the **Network** tab, and the **Performance monitor**
   (Ctrl/Cmd+Shift+P, "Show Performance monitor").
3. Optional: turn off the laptop's Wi-Fi to prove nothing comes from the
   internet.

## Planet (FR1)

- [ ] The planet appears with `earth.jpg` and turns slowly by itself.
- [ ] Dragging with the mouse turns it; on release it keeps turning (FR1.1).
- [ ] With **Forest height** active, the tall forest areas (Amazon, Congo,
      South-East Asia) are the most intense green and sit on the land of the
      base image, not shifted (FR1.2).
- [ ] The layer picker switches to **Wildfire smoke** and **Global CO2** and
      back to forest (FR1.4). Smoke and CO2 show only inside the Amazon
      rectangle.

## Transition and map (FR2, FR3)

- [ ] Clicking inside the Amazon starts the transition; clicking the ocean
      does nothing.
- [ ] The **Amazon** button does the same.
- [ ] Way there: the planet turns to the Amazon, flattens and the camera
      closes in. Time it (stopwatch or a screen recording): **2 s or less**
      (FR2.1). Expected 1.6 s.
- [ ] The map shows the Amazon rectangle with the active layer; smoke and CO2
      are visible here too (FR3).
- [ ] **Back to Earth**: the reverse in **2 s or less**, and the planet turns
      again (FR2.2). Expected 1.4 s.
- [ ] Buttons are greyed out during the transition.

## Cursor and indicator (FR4)

- [ ] Over the planet, the indicator shows longitude and latitude that match
      the place under the cursor (for example Manaus about 60° W, 3° S).
- [ ] With forest active, the value over the Amazon is high (above about
      60 %) and over the Atlantic Ocean low or "no data here" (FR4.4).
- [ ] On the map, the indicator follows the cursor in the same way.
- [ ] Moving the cursor off the planet or the map clears the indicator, and
      it stays empty during the transition. The listening point is kept (not
      `null`) during the transition so the sound does not cut out (FR4.3,
      FR5.2).
- [ ] With the cursor still over the planet, the indicator keeps following the
      place under it as the planet turns (FR6).
- [ ] With the cursor still, switching the layer picker updates the indicator
      value at once, without moving the mouse.
- [ ] With the cursor still over the Amazon, the indicator is back as soon as
      the transition ends.
- [ ] Optional, with React DevTools: the `ListeningPointProvider` state holds
      `{ lon, lat, screenX }` and `screenX` goes from 0 at the left edge to 1
      at the right edge of the canvas.

## Smoothness (NFR1)

- [ ] The counter (top right) stays at **30 fps or more** while the planet
      turns, while dragging, during both transitions and on the map. The
      Performance monitor agrees.
- [ ] If it does not: open `http://127.0.0.1:5173/?lite=1` and repeat. The
      counter shows `· lite` and the map appears at once (plan B).

## Offline (NFR2)

- [ ] The Network tab shows requests only to `127.0.0.1:5173`
      (`manifest.json`, the `.bin` grids, `earth.jpg`, the app's own files).
      Nothing from any other host.

## Error case

- [ ] Temporarily rename `web/public/data/earth.jpg` and reload: a warning
      says the planet image could not be loaded, the planet is drawn over a
      plain ocean colour, and the layers, map and buttons still work. Rename
      it back afterwards.

## High-resolution data (intent 261114-hires-data-layers)

After `docker compose run --rm fetch` and `docker compose run --rm prep`. The
planet now loads `earth-8k.jpg` (or `earth-4k.jpg`) and `earth-amazon.jpg`
instead of `earth.jpg`, and the layers are **Forest height**, **Wildfire
smoke** and **Lightning** (no more Global CO2). Lines above that name
`earth.jpg` or CO2 apply to the new files and layers in the same way.

- [ ] **Which image (FR1.2).** In the Network tab, a normal load asks for
      `earth-8k.jpg` on a laptop whose graphics card accepts 8192-pixel
      textures, and `earth-4k.jpg` otherwise. With `?lite=1` it asks for
      `earth-4k.jpg` only, never `earth-8k.jpg`. Both load
      `earth-amazon.jpg`.
- [ ] **Sharp planet (FR1.1).** Zoomed on the planet, coastlines, rivers and
      relief look sharp, with no blocky pixels, on the 8192 image.
- [ ] **Sharp Amazon map (FR1.3).** On the map the Amazon shows the crop:
      the Amazon river and its tributaries are crisp, sharper than the
      planet around the rectangle, and the edge of the rectangle shows no
      jump in colour or position.
- [ ] **30 fps with the 8192 image (NFR3).** The counter stays at 30 fps or
      more while the planet turns, while dragging, during both transitions
      and on the map, with `earth-8k.jpg` loaded.
- [ ] **Ready in 5 s (NFR3).** From pressing reload to the planet drawn with
      its image and the layer picker usable: **5 s or less** (Network tab
      "Load", or a stopwatch).
- [ ] **Forest on the rivers (FR6.2).** With **Forest height** on the map,
      the forest edges and the gaps along the large rivers line up with the
      rivers and coasts of the base image, not shifted.
- [ ] **No forest gaps (FR6.1).** On the planet, forest height shows on every
      continent with no empty band of longitude between the views.
- [ ] **Smoke, 24 instants (FR4.1).** With **Wildfire smoke** active, the
      panel says `Showing the first instant: Sep 1, 2026 00:30 UTC` and the
      smoke shows over the whole planet. When the timeline is wired in, its
      dates run through all 24 hours to `Sep 1, 2026 23:30 UTC` while forest
      and lightning keep their single date.
- [ ] **Lightning (FR5).** **Lightning** is in the layer picker, brightest
      over central Africa, north-west South America and South-East Asia, and
      reads 0 % or close to it far out at sea and near the poles.
- [ ] **Offline (NFR2).** With the Wi-Fi off, all three layers and both
      images load from `127.0.0.1:5173`.

## Result

- Decision at 11:00 p.m.: keep the flattening planet / go to plan B (`?lite=1`).
- Notes:
