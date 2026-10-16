# Infomac Solutions — site

One static page. No build step, no framework, no dependencies: `index.html` carries its own
styles and the single piece of script that drives the live rebrand demo.

## Deploying on Netlify

Add a new site from this repository. Netlify reads `netlify.toml`, so there is nothing to
configure:

- **Build command** — none
- **Publish directory** — the repository root

Pushing to `main` redeploys. For a one-off, dragging this folder onto the Netlify dashboard
works equally well.

## What is where

| Path | What it is |
|---|---|
| `index.html` | The entire site — markup, styles and the rebrand script |
| `assets/platform-demo.mp4` | Screen recording of the platform, unbranded (13 MB) |
| `assets/app-icon-512.png` | White-label app icon, for store listings or a favicon |
| `netlify.toml` | Publish settings and cache headers |

## Editing it

**Wording** lives in the markup, in plain English — the capability cards, the licensing
steps and the specification table are ordinary HTML.

**Colours** are CSS custom properties at the top of the file:

- `--accent` is Infomac's own mark (workshop teal). The site chrome uses this.
- `--brand` is the *licensee's* colour, the one the hero demo changes. It starts as indigo
  and is overwritten live by the swatches.
- `--ink` / `--paper` are the near-black and warm off-white the page is built on.

**The demo** is the hero's selling point: a visitor types their own brand name and picks a
colour, and the mock app rebrands as they watch. The icon glyph flips between black and
white according to the contrast of the chosen colour, so a black or pale brand still reads.

## Things to fix before this goes in front of anyone

- **`hello@infomacsolutions.co.uk` is a placeholder.** Replace it with a real address, and
  with a phone number if you want one.
- **No favicon or Open Graph image yet.** A link shared on WhatsApp or LinkedIn will show
  nothing. `assets/app-icon-512.png` is a reasonable favicon; a 1200x630 share image needs
  making.
- **The registrations in the hero mock are real vehicles** (PJ19FBK and the rest). They read
  as credible, but they belong to a customer — consider inventing plates instead.
- **No analytics, no cookie banner.** Deliberate: the site sets no cookies and tracks
  nobody, so it needs no banner. Adding analytics changes that.
