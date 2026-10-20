# Third-party notices

## Dioramas

`src/core/` is vendored from **Dioramas** — https://github.com/blendi-remade/dioramas —
a framework for cinematic, interactive 3D websites. Copyright (c) 2026 Blendi, MIT licence.

The files taken are `engine.js`, `input.js`, `scroll.js`, `textures.js`, `volumetric.js`
and `reflector.js`, unmodified apart from a provenance header on each. Dioramas' asset
pipeline, its `assets.js`, its gallery chrome (`ui.js`, `worlds.js`) and its twenty example
worlds are not used here — this site has no loaded models, and the lorry in the hero is
built from geometry in `src/site/lorry.js`.

Fixes to the engine belong upstream, not in `src/core/`.

```
MIT License

Copyright (c) 2026 Blendi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Libraries

| Package | Licence |
|---|---|
| three.js | MIT |
| postprocessing (pmndrs) | Zlib |
| n8ao | CC0-1.0 |
| GSAP, incl. ScrollTrigger and SplitText | GSAP Standard "no charge" licence — https://gsap.com/standard-license |
| Lenis | MIT |
| Vite | MIT |

## Fonts

Archivo, IBM Plex Sans and IBM Plex Mono are served from Google Fonts under the
SIL Open Font License 1.1.
