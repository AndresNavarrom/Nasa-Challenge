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
      it stays empty during the transition (listening point `null`, FR4.3).
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

## Result

- Decision at 11:00 p.m.: keep the flattening planet / go to plan B (`?lite=1`).
- Notes:
