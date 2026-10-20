// Renders demo.html frame by frame and encodes public/assets/platform-demo.mp4.
//
// The page exposes window.__seek(t), so capture is deterministic: there is no
// reliance on wall-clock animation, and re-running this produces the same video
// (bar the per-frame sensor grain in the camera tiles).
//
//   cd scripts/demo && npm install && npm run record
//
// Uses the Chrome or Edge already on the machine rather than downloading a
// browser, hence playwright-core rather than playwright.
import { chromium } from 'playwright-core';
import ffmpeg from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const FRAMES = path.join(here, 'frames');
const OUT = path.resolve(here, '../../public/assets/platform-demo.mp4');

const FPS = 25;
// 360x840 at a device scale of 3 is 1080x2520 — the shape of the recording this
// replaces, so the page's video frame needs no layout change.
const VIEW = { width: 360, height: 840 };
const SCALE = 3;

const CHANNELS = ['chrome', 'msedge'];

async function launch() {
  for (const channel of CHANNELS) {
    try {
      const b = await chromium.launch({ channel, args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
      console.log(`browser: ${channel}`);
      return b;
    } catch { /* try the next one */ }
  }
  throw new Error('Neither Chrome nor Edge could be launched. Install one, or run `npx playwright install chromium`.');
}

const run = (bin, args) => new Promise((res, rej) => {
  const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  p.on('error', rej);
  p.on('close', c => (c === 0 ? res() : rej(new Error(`${path.basename(bin)} exited ${c}`))));
});

const main = async () => {
  await rm(FRAMES, { recursive: true, force: true });
  await mkdir(FRAMES, { recursive: true });

  const browser = await launch();
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: SCALE });
  await page.goto(pathToFileURL(path.join(here, 'demo.html')).href + '?static=1',
    { waitUntil: 'networkidle' });
  // Roboto comes from Google Fonts; capturing before it lands would give two
  // different typefaces across the video.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const duration = await page.evaluate(() => window.__duration);
  const total = Math.round(duration * FPS);
  console.log(`capturing ${total} frames (${duration}s @ ${FPS}fps) at ${VIEW.width * SCALE}x${VIEW.height * SCALE}`);

  for (let i = 0; i < total; i++) {
    await page.evaluate(t => window.__seek(t), i / FPS);
    await page.screenshot({
      path: path.join(FRAMES, `f${String(i).padStart(5, '0')}.png`),
      animations: 'disabled',
    });
    if (i % 50 === 0 || i === total - 1) {
      process.stdout.write(`\r  ${i + 1}/${total}  ${(((i + 1) / total) * 100).toFixed(0)}%   `);
    }
  }
  process.stdout.write('\n');
  await browser.close();

  const n = (await readdir(FRAMES)).length;
  if (n !== total) throw new Error(`expected ${total} frames, found ${n}`);

  console.log('encoding…');
  await run(ffmpeg, [
    '-y',
    '-framerate', String(FPS),
    '-i', path.join(FRAMES, 'f%05d.png'),
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '27',
    // Browsers and phones want 4:2:0; without this some will not decode it.
    '-pix_fmt', 'yuv420p',
    // Start playing before the whole file arrives.
    '-movflags', '+faststart',
    OUT,
  ]);

  await rm(FRAMES, { recursive: true, force: true });
  if (!existsSync(OUT)) throw new Error('ffmpeg produced no file');
  console.log(`wrote ${OUT}`);
};

main().catch(e => { console.error(e); process.exit(1); });
