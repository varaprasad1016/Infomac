# Infomac Solutions — site

One page. The hero is an interactive 3D depot: a lorry you can turn round, with the
licensee's name and colour printed live onto the trailer curtain, and three markers on the
hardware the platform actually talks to — the tracker, the dashcam and the tachograph.

Built on the engine from [Dioramas](https://github.com/blendi-remade/dioramas) (MIT),
vendored into `src/core/` — see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Running it

```bash
npm install
npm run dev        # http://127.0.0.1:5180
npm run build      # -> dist/
npm run preview    # serve the build
```

This used to be a single `index.html` with no build step. It has one now, because
three.js, postprocessing and n8ao ship as bare ES modules that a browser cannot resolve on
its own. The page's own styles and markup are still plain HTML in `index.html`.

## Deploying on Netlify

`netlify.toml` carries the settings, so there is nothing to configure in the dashboard:
build with `npm run build`, publish `dist`. Pushing to `main` redeploys. Dragging the
folder onto the dashboard no longer works — it needs the build.

## What is where

| Path | What it is |
|---|---|
| `index.html` | The page — markup and all of the non-hero styling |
| `src/site/main.js` | The scene: lighting, camera rig, hotspots, drive toggle, brand console |
| `src/site/lorry.js` | The tractor unit and trailer, built from geometry |
| `src/site/hero.css` | Styling for the canvas, markers and readout cards |
| `src/core/` | The Dioramas engine, vendored. Fix bugs upstream, not here |
| `scripts/demo/` | Generates the walkthrough video. Its deps are its own, not the site's |
| `public/assets/platform-demo.mp4` | The platform walkthrough — generated, not recorded (see `scripts/demo/`) |
| `public/assets/app-icon-512.png` | White-label app icon, for store listings or a favicon |
| `netlify.toml` | Build, publish and cache headers |

Anything in `public/` is copied to the site root untouched, so the video stays at
`/assets/platform-demo.mp4`.

## The hero

**The demo is the selling point.** A visitor types their brand name and picks a colour, and
both are printed onto the trailer curtain as they type — the curtain is a canvas texture
redrawn on every keystroke. The strapline inside the colour band flips between black and
white on the contrast of the chosen colour, so a black or pale brand still reads.

**Four things respond to a visitor:**

- **Drag, or the arrow keys**, to orbit. Left alone it breathes around one composed angle
  rather than rotating away from it, so the hero always looks like the hero.
- **The three markers** — tracker, dashcam, tachograph — fly the camera to that piece of
  hardware and open its live readout. They are real buttons, so they work by keyboard; the
  3D hardware under them is clickable too, via a raycast.
- **Your name**, the fourth marker, turns the lorry side-on to the curtain.
- **Drive** turns the wheels, runs the road under them, lights the headlamps and starts
  the telemetry counting.

**Colours** are CSS custom properties at the top of `index.html`:

- `--accent` is Infomac's own mark (workshop teal). The site chrome uses this.
- `--brand` is the *licensee's* colour, the one the hero changes. It starts as indigo and
  is overwritten live by the swatches, in the CSS and in the 3D livery together.
- `--ink` / `--paper` are the near-black and warm off-white the page is built on.

**If WebGL2 is missing** the canvas is removed and a flat app-icon plate takes its place,
still driven by the name and colour. `prefers-reduced-motion` turns off the intro, the idle
drift and the smooth scrolling, and leaves the scene still but interactive.

**Performance.** `window.__fps` is set by the engine, and `window.__hero` exposes the
camera rig and the scene for checking framing from the console. Reflections and volumetric
beams are turned off below 860px, and the pixel ratio is capped.

## Things to fix before this goes in front of anyone

- **`hello@infomacsolutions.co.uk` is a placeholder.** Replace it with a real address, and
  with a phone number if you want one.
- **No favicon or Open Graph image yet.** A link shared on WhatsApp or LinkedIn will show
  nothing. `public/assets/app-icon-512.png` is a reasonable favicon; a 1200x630 share image
  needs making.
- **The old recording is still in git history.** The genuine capture of a live fleet was
  replaced (see `scripts/demo/`), but the original is still reachable in earlier commits on
  GitHub, real registrations and all. Purging it needs a history rewrite and a force push,
  which nobody has done yet.
- **No analytics, no cookie banner.** Deliberate: the site sets no cookies and tracks
  nobody, so it needs no banner. Adding analytics changes that.
