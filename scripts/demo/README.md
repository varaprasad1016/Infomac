# The platform demo video

`src/media/platform-demo.mp4` is **generated, not recorded.** This folder is what
generates it.

The site used to ship a genuine screen recording of the platform running on a live fleet.
It showed real vehicle registrations, real addresses on the map, real odometer readings and
— at about 58 seconds — a licensee's own product name, on a page that claims to be
unbranded throughout. None of that belongs on a public marketing site, so the recording was
replaced with this.

Everything in `demo.html` is invented: the registrations, the drivers, the place names, the
mileages, the clip list, the licence dates. The road layout on the map is drawn, not tiled
from a map provider, and it is labelled "Demo map" so nobody mistakes it for survey data.

## Regenerating it

```bash
cd scripts/demo
npm install
npm run record          # ~3 minutes, writes ../../src/media/platform-demo.mp4
```

It drives the Chrome or Edge already installed on the machine (hence `playwright-core`
rather than `playwright`, which would download its own browser). If neither is present,
`npx playwright install chromium` gives it one.

These dependencies are deliberately **not** in the site's own `package.json`: a Netlify
build should never have to install Playwright and a 74 MB ffmpeg binary to publish a static
page.

## How it works

`demo.html` is a mock of the platform's phone UI with a scripted timeline. It exposes
`window.__seek(t)`, so `record.mjs` steps through the whole thing a frame at a time rather
than racing a wall clock — the capture is deterministic and re-running it gives the same
video, bar the per-frame sensor grain in the camera tiles.

- **Size** — 360×840 CSS at a device scale of 3 gives 1080×2520, the same shape as the
  recording it replaced, so the page's video frame needed no layout change.
- **Length** — 48 seconds at 25 fps, against 74 seconds before.
- **Scenes** — dashboard, live map, four-channel camera view, clip download, the operations
  menu, and the driver's walkaround app.

## Editing it

Open `demo.html` in a browser and it plays on a loop, so the thing can be eyeballed without
rendering anything. Add `?static=1` to freeze it and drive it by hand from the console:

```js
__seek(21)   // jump to the camera scene
```

Scene boundaries are the `SCENES` array near the bottom of the file; the fleet, clips,
modules and checklist are the data tables above it. If you change the total length, change
`DURATION` with it — `record.mjs` reads it from the page.
