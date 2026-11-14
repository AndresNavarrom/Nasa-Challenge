# Sound Engine Checklist — Block B3

Manual verification for Step 10. The automated suite proves the graph and the
parameter values; only a real browser and a listener can prove the sound.
Record the results in the table at the end.

## Setup

```bash
docker compose up web
```

Open <http://127.0.0.1:5173/audio-check.html>. This development page is not part
of the app and is not included in the production build. It creates its own
engine, one slider per layer, pan, volume, a meter and a running timer.

Prerequisites:

- Headphones or speakers; a quiet room.
- Two people outside the team for the blind test (block B3).
- The browser's console open, to catch errors during the soak.

## 1. Start and autoplay (FR6)

| Check | Pass condition |
|---|---|
| Press **Start sound** without a prior click elsewhere | Audio starts; no console warning about a blocked AudioContext |
| Press **Stop**, wait, press **Start sound** again | Sound returns; the graph is not duplicated |
| Reload the page and start again | Works again |

## 2. Layer voice checks (FR3.1–FR3.4)

For each layer: clear the other two, move the slider slowly from 0 to 1 and back.

| Layer | Pass condition |
|---|---|
| Forest | Higher values sound higher, always in the five-note scale; no clicks when moving. |
| Smoke | Higher values sound rougher and darker; the tremolo becomes faster. |
| CO2 | Higher values breathe faster and lower. |
| Any layer with **no data** checked | The voice is silent; unchecking brings it back. |
| Pan slider | The sound moves left/right; it never disappears from one ear. |

## 3. Three-layer mix (FR4)

| Check | Pass condition |
|---|---|
| All three sliders around 0.7 | All three voices are audible; the meter stays below the top; no clipping or crackle. |
| Push all three to 1 | The limiter contains the level; the meter may touch the top but the sound stays clean. |
| Mute one layer at a time | The other two stay unchanged. |

## 4. Blind identification (B2 acceptance)

With two people outside the team, five trials per layer:

1. The tester picks a layer and a value (low ≈ 0.2 or high ≈ 0.8) without
   showing the listener.
2. The listener says which layer and whether it is low or high.
3. Record each answer.

Pass: at least **4 of 5** correct for each layer, and for high/low.

## 5. Latency (NFR2)

The page shows the device latency reported by the browser
(`AudioContext.baseLatency + outputLatency`). Record it.

For perceived latency (the number that matters):

1. Use a loopback recording (mic next to the speaker) or a slow-motion phone
   video: move the slider sharply and measure the time between the movement and
   the audible change.
2. Repeat five times and keep the maximum.

Pass: **≤ 100 ms** perceived latency.

## 6. Ten-minute soak (NFR5)

1. Start the sound with all three layers around 0.5.
2. Move the sliders and pan occasionally, as a person would.
3. Let it run for **10 minutes** by the timer in the page.
4. Watch the console and listen.

Pass: no dropouts, no clicks, no errors in the console, and the timer reaches
10 minutes with the sound still running.

## 7. Amazon border (after Step 12)

This needs the scene: the forest jumps from the detailed regional grid to the
coarse global grid at the Amazon rectangle. With the scene wired:

1. Move the listened point slowly across the rectangle edge.
2. Listen for a click or a jump.

Pass: a short glide, no click. The one-pole smoother in `smoothing.ts` is the
first defence; if the jump survives, add a crossfade at the edge in the scene
adapter.

## 8. Browsers

Run sections 1, 2, 3, 5 and 6 in at least two browsers (for example Chrome and
Firefox). Note any difference in latency or autoplay behaviour.

## Results

| Date | Browser | Device latency | Perceived latency (max) | Blind test | Soak 10 min | Notes |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

Sign-off for B3: every row above passes in two browsers, and the perceived
latency is at or below 100 ms.
