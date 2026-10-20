// The hero: a lorry in a depot bay, lit and interactive.
//
// Built on the Dioramas engine (src/core, vendored — see THIRD_PARTY_NOTICES.md):
// HDR post stack with N8AO and AgX tone mapping, raymarched volumetric spotlights,
// planar reflections on the wet yard floor, GPU-baked procedural textures, and
// GSAP/Lenis for the page's scroll behaviour.
//
// Four things a visitor can do, which is the whole point of the section:
//   1. Drag the scene round — the camera orbits the rig.
//   2. Type a brand name and pick a colour — both print onto the trailer curtain.
//   3. Click one of the three markers on the lorry — the camera flies to that piece
//      of hardware and its live readout opens beside it.
//   4. Press Drive — the wheels turn, the lights come on, the telemetry runs.
import { Engine, THREE, studioEnvironment, damp, clamp } from '../core/engine.js';
import { Pointer } from '../core/input.js';
import { VolumetricSpotEffect } from '../core/volumetric.js';
import { PlanarReflection } from '../core/reflector.js';
import { bakeTexture, fbmNormal } from '../core/textures.js';
import { smoothScroll, gsap, reveal, ScrollTrigger } from '../core/scroll.js';
import { buildLorry } from './lorry.js';
import './hero.css';

const DEG = Math.PI / 180;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const MOBILE = matchMedia('(max-width: 860px)').matches;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// ── The brand console, which works with or without 3D ────────────────────────
// Kept outside the WebGL boot on purpose: if the scene cannot start, typing a
// name and picking a colour must still do something, because that is the pitch.

/** Relative luminance, so a black or pale brand still reads. */
const readableInk = hex => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#0b0e12' : '#ffffff';
};

const nameInput = $('#brandName');
const swatches = $('#swatches');
const heroName = $('#heroName');
const root = document.documentElement;

const brand = { name: 'Your Fleet', colour: '#5b4bff', ink: '#ffffff' };
const brandListeners = [];
const onBrand = f => { brandListeners.push(f); f(brand); };
const emitBrand = () => { for (const f of brandListeners) f(brand); };

function setName(value) {
  brand.name = (value ?? '').trim() || 'Your Fleet';
  heroName.textContent = brand.name;
  $$('[data-brand-name]').forEach(el => { el.textContent = brand.name; });
  emitBrand();
}

function setColour(hex) {
  brand.colour = hex;
  brand.ink = readableInk(hex);
  root.style.setProperty('--brand', hex);
  root.style.setProperty('--brand-ink', brand.ink);
  [...swatches.children].forEach(b => b.setAttribute('aria-pressed', String(b.dataset.colour === hex)));
  emitBrand();
}

nameInput.addEventListener('input', () => setName(nameInput.value));
swatches.addEventListener('click', e => {
  const b = e.target.closest('button[data-colour]');
  if (b) setColour(b.dataset.colour);
});
setName(nameInput.value);

// The dashcam card's channel selector. Four channels is what the recorders in the
// demo fleet actually have, and picking between them is the one thing anyone
// tries first on a camera page.
const channels = $('#camChannels');
if (channels) {
  const pick = chip => {
    [...channels.children].forEach(c => c.classList.toggle('on', c === chip));
  };
  channels.addEventListener('click', e => {
    const chip = e.target.closest('[data-ch]');
    if (chip) pick(chip);
  });
  channels.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const chip = e.target.closest('[data-ch]');
    if (!chip) return;
    e.preventDefault();
    pick(chip);
  });
}

// ── Page scroll and section reveals ──────────────────────────────────────────
// Lenis replaces the old CSS `scroll-behavior: smooth`, so the anchors in the
// masthead have to be routed through it or they jump.
if (!REDUCED) {
  const lenis = smoothScroll({ lerp: 0.09 });
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    lenis.scrollTo(t, { offset: -70 });
  }));
  // SplitText cuts a mask per line, so it has to measure after the webfonts have
  // landed. Split against the fallback font and the swap reflows the text inside
  // masks that no longer line up — headings end up clipped through the middle.
  const startReveals = () => {
    try {
      reveal('[data-reveal]', { type: 'lines', stagger: 0.06, duration: 0.9 });
      ScrollTrigger.refresh();
    } catch (err) {
      // A decorative animation must never be the reason a heading is unreadable.
      console.warn('[reveal] disabled:', err?.message ?? err);
      $$('[data-reveal]').forEach(el => { el.style.opacity = '1'; el.style.visibility = 'visible'; });
    }
  };
  if (document.fonts?.ready) document.fonts.ready.then(startReveals);
  else startReveals();
}

// ── Hotspots ─────────────────────────────────────────────────────────────────
// The markers are HTML, projected from anchors inside the model each frame. They
// are real buttons so they work by keyboard and read correctly to a screen
// reader; the 3D hardware under them is also clickable via a raycast.
const HOTSPOTS = [
  { key: 'tracker', label: 'Tracker', view: { dist: 8.4, az: 26, el: 16, bias: [-0.6, -0.9, 0] } },
  { key: 'dashcam', label: 'Dashcam', view: { dist: 7.6, az: 15, el: 7, bias: [-0.5, -0.7, 0] } },
  { key: 'tacho', label: 'Tachograph', view: { dist: 7.2, az: 88, el: 6, bias: [-0.4, -0.5, 0] } },
  { key: 'brand', label: 'Your name', view: { dist: 15, az: 92, el: 7, bias: [-4.2, 0.4, 0] } },
];

const stage = $('#heroStage');
const canvas = $('#gl');
const hint = $('#heroHint');
const driveBtn = $('#driveBtn');

// ── Boot the scene, or fall back ─────────────────────────────────────────────
let engine;
try {
  // A context probe first: constructing the Engine on a machine with no WebGL2
  // throws from deep inside three.js, and the message is not useful to anyone.
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe) throw new Error('WebGL2 unavailable');
  engine = startScene();
} catch (err) {
  console.warn('[hero] 3D scene unavailable, using the flat fallback:', err?.message ?? err);
  stage.dataset.fallback = 'true';
  canvas.remove();
  hint?.remove();
  driveBtn?.remove();
  $$('.hs').forEach(el => el.remove());
}

function startScene() {
  let vol = null;

  const engine = new Engine({
    canvas,
    fov: 34, near: 0.1, far: 220,
    dpr: MOBILE ? 1.25 : 1.7,
    background: 0x07090d,
    post: {
      ao: { aoRadius: 1.0, intensity: 2.3, distanceFalloff: 0.9, halfRes: true },
      bloom: { intensity: 0.55, luminanceThreshold: 0.86, luminanceSmoothing: 0.3, radius: 0.74 },
      // Volumetric beams belong in HDR space, before tone mapping.
      pre: cam => MOBILE ? [] : [(vol = new VolumetricSpotEffect(cam, {
        density: 0.028, noise: 0.9, noiseScale: 0.85, maxDist: 46, floorY: 0,
        wind: new THREE.Vector3(0.03, 0.012, 0.01),
      }))],
      tone: 'agx',
      vignette: { offset: 0.26, darkness: 0.70 },
      noise: 0.055,
      ca: MOBILE ? 0 : 0.0009,
    },
  });

  const { scene, camera, renderer } = engine;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene.fog = new THREE.FogExp2(0x07090d, 0.016);
  scene.environment = studioEnvironment(renderer, {
    top: 0x1d242e, bottom: 0x05070a,
    panels: [
      { pos: [0, 11, 7], size: [16, 5], intensity: 5.0, color: 0xfff3e2 },
      { pos: [-13, 5, -5], size: [5, 9], intensity: 2.4, color: 0xdceaff },
      { pos: [13, 6, -4], size: [4, 10], intensity: 2.0, color: 0xffeede },
    ],
  });
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight(0x2b3747, 0x0a0c10, 0.20));

  // ── The yard floor ──────────────────────────────────────────────────────────
  // Wet asphalt: dark aggregate, polished tyre tracks, painted bay lines, and
  // standing water. The roughness map is what the planar reflection reads to
  // decide how far to blur, so the puddles are the only smooth part.
  const floorAlbedo = bakeTexture(renderer, 1024, `
    void main(){
      float grain = fbm(vUv * 180.0, 180.0, 4, 0.55);
      float agg   = fbm(vUv * 52.0, 52.0, 5, 0.5);
      vec3 base = vec3(0.034, 0.036, 0.040) * (0.78 + agg * 0.55 + grain * 0.22);

      // Two polished tyre tracks running the length of the bay.
      float tracks = smoothstep(0.055, 0.0, abs(vUv.y - 0.40)) + smoothstep(0.055, 0.0, abs(vUv.y - 0.60));
      base = mix(base, base * 1.5 + 0.006, tracks * 0.7);

      // Painted bay line, scuffed by the fbm so it is not a clean rectangle.
      float line = smoothstep(0.009, 0.004, abs(vUv.y - 0.145));
      float wear = smoothstep(0.25, 0.75, fbm(vUv * 34.0, 34.0, 4, 0.5) + 0.5);
      base = mix(base, vec3(0.42, 0.40, 0.33), line * wear * 0.85);

      // Oil staining where the units park.
      float oil = smoothstep(0.62, 0.95, fbm(vUv * 9.0 + 3.3, 9.0, 5, 0.55) + 0.5);
      base *= 1.0 - oil * 0.42;
      gl_FragColor = vec4(base, 1.0);
    }`);
  const floorRough = bakeTexture(renderer, 1024, `
    void main(){
      float dry = 0.74 + fbm(vUv * 60.0, 60.0, 4, 0.5) * 0.2;
      // Puddles: broad low-frequency pools that go almost mirror-smooth.
      float pool = smoothstep(0.70, 0.93, fbm(vUv * 5.0 - 1.7, 5.0, 5, 0.6) + 0.5);
      float tracks = smoothstep(0.06, 0.0, abs(vUv.y - 0.40)) + smoothstep(0.06, 0.0, abs(vUv.y - 0.60));
      float r = mix(dry, 0.07, pool);
      r = mix(r, r * 0.55, tracks * 0.6);
      gl_FragColor = vec4(1.0, clamp(r, 0.04, 1.0), 0.0, 1.0);
    }`);
  const floorNormal = fbmNormal(renderer, { size: 1024, scale: 70, octaves: 5, strength: 0.7 });

  const aniso = renderer.capabilities.getMaxAnisotropy();
  for (const t of [floorAlbedo, floorRough, floorNormal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    t.repeat.set(3, 3);
  }
  floorAlbedo.colorSpace = THREE.SRGBColorSpace;

  const floorMat = new THREE.MeshStandardMaterial({
    map: floorAlbedo, roughnessMap: floorRough, normalMap: floorNormal,
    normalScale: new THREE.Vector2(0.22, 0.22),
    roughness: 1, metalness: 0.08, envMapIntensity: 0.5,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), floorMat);
  floor.rotation.x = -90 * DEG;
  floor.receiveShadow = true;
  scene.add(floor);

  // Reflections are the main cost in this scene; a phone does without them.
  let refl = null;
  if (!MOBILE) {
    refl = new PlanarReflection(renderer, { resolution: 0.5 });
    refl.hidden.push(floor);
    refl.patch(floorMat, { strength: 0.9, distort: 0.05, lodScale: 8, lodBias: 0.4, f0: 0.035 });
    engine.onResize((w, h, dpr) => refl.setSize(w, h, dpr));
  }

  // A dark shed wall well behind the lorry, to catch the rim light and stop the
  // beams marching off into flat fog.
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 60),
    new THREE.MeshStandardMaterial({ color: 0x0c1017, roughness: 0.9, metalness: 0.1 }),
  );
  wall.position.set(-6, 28, -34);
  wall.receiveShadow = true;
  scene.add(wall);

  // ── Lights ──────────────────────────────────────────────────────────────────
  // One warm key from the front right that casts the shadow, one cool rim from
  // behind to separate the trailer from the wall, both fed to the fog.
  const key = new THREE.SpotLight(0xfff0dc, 2300, 90, 34 * DEG, 0.5, 1.5);
  key.position.set(17, 10.5, 14);
  key.target.position.set(0.5, 1.5, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 60;
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 2;
  scene.add(key, key.target);

  const rim = new THREE.SpotLight(0xbfd8ff, 1700, 100, 38 * DEG, 0.6, 1.4);
  rim.position.set(-20, 13, -14);
  rim.target.position.set(-5, 2.2, 0);
  scene.add(rim, rim.target);

  const fill = new THREE.DirectionalLight(0x8ea7c4, 0.30);
  fill.position.set(-6, 8, 16);
  scene.add(fill);

  vol?.add(key, { scale: 0.000022, range: 0.0022, softness: 0.3 })
     .add(rim, { scale: 0.000030, range: 0.0030, softness: 0.35 });

  // ── The lorry ───────────────────────────────────────────────────────────────
  const lorry = buildLorry(renderer);
  scene.add(lorry.root);
  onBrand(b => lorry.setBrand(b.colour, b.name, b.ink));

  // Headlights: real cones so the beams show in the fog when Drive is on.
  const beams = [];
  for (const z of [-0.82, 0.82]) {
    const beam = new THREE.SpotLight(0xffeccd, 0, 40, 17 * DEG, 0.55, 1.4);
    beam.position.set(6.4, 1.1, z);
    beam.target.position.set(34, 0.2, z * 2.4);
    scene.add(beam, beam.target);
    beams.push(beam);
  }
  // Only two volumetric slots are left of the four the effect allows.
  if (vol) for (const b of beams) vol.add(b, { scale: 0.000055, range: 0.0045, softness: 0.25 });

  // ── Camera rig ──────────────────────────────────────────────────────────────
  // Spherical orbit with damped goals. Selecting a hotspot sets the goals; a drag
  // takes them back. `az` is measured round +Y from the nose, `el` upward.
  const IDLE = { dist: MOBILE ? 28.5 : 27, az: 33, el: 12, target: new THREE.Vector3(-1.0, 2.1, 0) };
  const rig = {
    dist: IDLE.dist + 7, az: IDLE.az - 16, el: IDLE.el + 9,
    target: IDLE.target.clone(),
    gDist: IDLE.dist, gAz: IDLE.az, gEl: IDLE.el,
    gTarget: IDLE.target.clone(),
    // How far left of the subject the camera aims, as a fraction of the visible
    // width. On a wide screen the copy owns the left half, so the lorry is sat
    // over to the right; on a phone the copy is underneath and it stays centred.
    shiftFrac: MOBILE ? 0 : 0.07,
    gShift: MOBILE ? 0 : 0.07,
  };
  // The offset belongs to the layout, not to the device: rotating a tablet moves
  // the copy from beside the lorry to underneath it, and the framing follows.
  const wide = matchMedia('(min-width: 861px)');
  let BASE_SHIFT = wide.matches ? 0.07 : 0;
  wide.addEventListener('change', e => {
    BASE_SHIFT = e.matches ? 0.07 : 0;
    if (!selected) rig.gShift = BASE_SHIFT;
  });
  let selected = null;        // the open hotspot key
  let userDriving = false;    // the visitor has dragged, so stop drifting
  let lastInput = performance.now();

  const _right = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const applyRig = () => {
    const a = rig.az * DEG, e = rig.el * DEG;
    camera.position.set(
      rig.target.x + Math.cos(e) * Math.cos(a) * rig.dist,
      rig.target.y + Math.sin(e) * rig.dist,
      rig.target.z + Math.cos(e) * Math.sin(a) * rig.dist,
    );
    _look.copy(rig.target);
    if (rig.shiftFrac) {
      // Visible width at the target, so the offset holds at any aspect ratio.
      const visW = 2 * rig.dist * Math.tan(camera.fov * DEG / 2) * camera.aspect;
      // Ground-plane right vector of the camera; aiming the opposite way puts
      // the subject on the right of frame.
      _right.set(Math.sin(a), 0, -Math.cos(a));
      _look.addScaledVector(_right, -visW * rig.shiftFrac);
    }
    camera.lookAt(_look);
  };
  applyRig();

  function goTo({ dist, az, el, target }) {
    rig.gDist = dist; rig.gAz = az; rig.gEl = el;
    if (target) rig.gTarget.copy(target);
  }
  const goIdle = () => goTo({ ...IDLE, target: IDLE.target });

  // ── Drag to orbit ───────────────────────────────────────────────────────────
  let dragging = false, lastX = 0, lastY = 0, vAz = 0;
  const onDown = e => {
    // Let the markers and the console take their own clicks.
    if (e.target !== canvas) return;
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    userDriving = true; lastInput = performance.now();
    stage.dataset.grabbing = 'true';
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onMove = e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    rig.gAz = rig.gAz - dx * 0.26;
    rig.gEl = clamp(rig.gEl + dy * 0.16, -3, 46);
    vAz = -dx * 0.26;
    lastInput = performance.now();
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    stage.dataset.grabbing = 'false';
    hint?.setAttribute('data-used', 'true');
  };
  canvas.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);

  // Keyboard orbit, so the scene is not mouse-only.
  canvas.addEventListener('keydown', e => {
    const step = e.shiftKey ? 12 : 5;
    if (e.key === 'ArrowLeft') rig.gAz += step;
    else if (e.key === 'ArrowRight') rig.gAz -= step;
    else if (e.key === 'ArrowUp') rig.gEl = clamp(rig.gEl + step * 0.6, -3, 46);
    else if (e.key === 'ArrowDown') rig.gEl = clamp(rig.gEl - step * 0.6, -3, 46);
    else return;
    e.preventDefault();
    userDriving = true;
    lastInput = performance.now();
  });

  // ── Hotspot markers and cards ───────────────────────────────────────────────
  const spots = HOTSPOTS.map(h => {
    const el = $(`.hs[data-hs="${h.key}"]`);
    return {
      ...h,
      el,
      dot: el?.querySelector('.hs-dot'),
      card: $(`.hs-card[data-card="${h.key}"]`),
      anchor: lorry.anchors[h.key],
      pos: new THREE.Vector3(),
      visible: false,
    };
  }).filter(s => s.el && s.anchor);

  // Invisible pick spheres, so clicking the hardware itself selects it too.
  const pickGeo = new THREE.SphereGeometry(0.34, 10, 8);
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });
  for (const s of spots) {
    const p = new THREE.Mesh(pickGeo, pickMat);
    p.userData.hotspot = s.key;
    s.anchor.add(p);
    s.pick = p;
  }
  const picks = spots.map(s => s.pick);
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function select(key) {
    selected = selected === key ? null : key;
    for (const s of spots) {
      const on = s.key === selected;
      s.el.setAttribute('aria-expanded', String(on));
      s.el.dataset.active = String(on);
      s.card?.toggleAttribute('hidden', !on);
      if (s.card && on && !REDUCED) {
        gsap.fromTo(s.card, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.42, ease: 'power3.out' });
      }
    }
    stage.dataset.selected = selected ?? '';
    if (selected) {
      const s = spots.find(x => x.key === selected);
      const t = s.anchor.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...s.view.bias));
      goTo({ ...s.view, target: t });
      rig.gShift = 0;
      userDriving = false;
      hint?.setAttribute('data-used', 'true');
    } else {
      goIdle();
      rig.gShift = BASE_SHIFT;
    }
  }

  for (const s of spots) {
    s.el.addEventListener('click', ev => { ev.stopPropagation(); select(s.key); });
    s.card?.querySelector('.hs-close')?.addEventListener('click', () => select(selected));
  }

  // Click the lorry itself. A drag must not count as a click, so compare positions.
  let downAt = null;
  canvas.addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(picks, false)[0];
    if (hit) select(hit.object.userData.hotspot);
    else if (selected) select(selected);
  });

  // Hover the hardware: swell the matching marker so the two read as one thing.
  if (!COARSE) canvas.addEventListener('pointermove', e => {
    if (dragging) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(picks, false)[0];
    const key = hit?.object.userData.hotspot ?? null;
    stage.dataset.hover = key ?? '';
    for (const s of spots) s.el.dataset.hover = String(s.key === key);
  }, { passive: true });

  addEventListener('keydown', e => { if (e.key === 'Escape' && selected) select(selected); });

  // ── Drive ───────────────────────────────────────────────────────────────────
  // Not decoration: it is the difference between a render and a tracked vehicle.
  const telemetry = { on: false, speed: 0, gSpeed: 0, dist: 0, breakMins: 129 };
  const speedEl = $('#tSpeed');
  const odoEl = $('#tOdo');
  const breakEl = $('#tBreak');
  const stateEls = $$('[data-drive-state]');

  function setDrive(on) {
    telemetry.on = on;
    telemetry.gSpeed = on ? 54 : 0;
    driveBtn.setAttribute('aria-pressed', String(on));
    driveBtn.querySelector('.drive-label').textContent = on ? 'Stop' : 'Drive';
    stage.dataset.driving = String(on);
    for (const el of stateEls) {
      el.textContent = on ? el.dataset.driveState : 'Parked';
      el.classList.toggle('muted', !on);
    }
    // Headlamp emissive and the spot intensity move together, or the glass lights
    // up with no beam behind it.
    gsap.to({ v: on ? 0 : 1 }, {
      v: on ? 1 : 0, duration: 0.55, ease: 'power2.inOut',
      onUpdate() {
        const v = this.targets()[0].v;
        for (const b of beams) b.intensity = 900 * v;
        lorry.materials.lampWhite.emissiveIntensity = 0.8 + v * 4.2;
        lorry.materials.lampAmber.emissiveIntensity = 0.5 + v * 1.4;
        lorry.materials.lampRed.emissiveIntensity = 0.6 + v * 1.8;
      },
    });
  }
  driveBtn?.addEventListener('click', () => setDrive(!telemetry.on));
  setDrive(false);

  // ── Intro ───────────────────────────────────────────────────────────────────
  renderer.compile(scene, camera);   // avoid the first-frame shader hitch
  engine.start();

  if (!REDUCED) {
    gsap.to(rig, {
      dist: IDLE.dist, az: IDLE.az, el: IDLE.el,
      duration: 2.6, ease: 'power3.out', onUpdate: applyRig,
    });
    gsap.from('[data-hero-in]', {
      y: 26, autoAlpha: 0, duration: 1.1, ease: 'power3.out', stagger: 0.09, delay: 0.25,
    });
  } else {
    rig.dist = IDLE.dist; rig.az = IDLE.az; rig.el = IDLE.el;
    applyRig();
  }

  // ── Frame loop ──────────────────────────────────────────────────────────────
  const pointer = new Pointer({ lambda: 5 });
  const projected = new THREE.Vector3();
  let introDone = false;
  setTimeout(() => { introDone = true; }, REDUCED ? 0 : 2600);

  engine.onTick((dt, t) => {
    pointer.update(dt);

    // Idle drift. It breathes around the composed framing instead of rotating
    // away from it: a continuous turn means whoever arrives thirty seconds in
    // gets the back of the trailer, and the hero has one good angle.
    const sinceInput = (performance.now() - lastInput) / 1000;
    if (!REDUCED && !selected && !dragging && introDone) {
      if (sinceInput > 5) userDriving = false;
      if (!userDriving) {
        rig.gAz = IDLE.az + Math.sin(t * 0.17) * 7;
        rig.gEl = IDLE.el + Math.sin(t * 0.11) * 1.6;
      }
    }
    // Inertia from the end of a drag.
    if (!dragging && Math.abs(vAz) > 0.01) {
      rig.gAz += vAz * dt * 7;
      vAz = damp(vAz, 0, 4, dt);
    }

    if (introDone) {
      rig.az = damp(rig.az, rig.gAz, 4.2, dt);
      rig.el = damp(rig.el, rig.gEl, 4.2, dt);
      rig.dist = damp(rig.dist, rig.gDist, 3.4, dt);
      rig.shiftFrac = damp(rig.shiftFrac, rig.gShift, 3.4, dt);
      rig.target.x = damp(rig.target.x, rig.gTarget.x, 3.4, dt);
      rig.target.y = damp(rig.target.y, rig.gTarget.y, 3.4, dt);
      rig.target.z = damp(rig.target.z, rig.gTarget.z, 3.4, dt);

      applyRig();
      // A whisper of pointer parallax, applied after the rig so it never fights
      // the damped goals — and never while the visitor is driving the camera.
      if (!selected && !dragging && !REDUCED) {
        camera.position.y += pointer.sy * 0.28;
        camera.position.x += pointer.sx * 0.22;
        camera.lookAt(_look);
      }
    }

    // Telemetry and wheels.
    telemetry.speed = damp(telemetry.speed, telemetry.gSpeed, 1.4, dt);
    if (telemetry.speed > 0.2) {
      const mps = telemetry.speed * 0.44704;
      const spin = (mps / lorry.dims.wheelR) * dt;
      for (const w of lorry.wheels) w.rotation.z -= spin;
      telemetry.dist += mps * dt / 1000;
      telemetry.breakMins = Math.max(0, telemetry.breakMins - dt / 60);
      // The road scrolls under the lorry rather than moving it: the camera rig
      // and the lights all key off the origin. The lorry faces +X and the floor
      // plane's U axis runs along +X, so the offset has to *increase* to slide
      // the tarmac backwards. Decrementing it drives the thing in reverse.
      const roll = mps * dt * 0.012;
      floorAlbedo.offset.x += roll;
      floorRough.offset.x += roll;
      floorNormal.offset.x += roll;
    }
    if (speedEl) speedEl.textContent = `${Math.round(telemetry.speed)} mph`;
    if (odoEl) odoEl.textContent = `${telemetry.dist.toFixed(1)} mi`;
    if (breakEl) {
      const m = Math.round(telemetry.breakMins);
      breakEl.textContent = telemetry.on ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : '—';
    }

    // Beacons flash only while moving. They share one material, so this drives
    // every amber lamp on the vehicle at once, which is what a real bar does.
    if (telemetry.on) {
      lorry.materials.lampAmber.emissiveIntensity = Math.sin(t * 7) > 0.4 ? 3.4 : 0.5;
    }

    // Project the markers. Behind-camera and off-stage markers are hidden, or
    // they pile up at the edge of the frame.
    const r = canvas.getBoundingClientRect();
    for (const s of spots) {
      s.anchor.getWorldPosition(s.pos);
      projected.copy(s.pos).project(camera);
      const behind = projected.z > 1;
      const x = (projected.x * 0.5 + 0.5) * r.width;
      const y = (-projected.y * 0.5 + 0.5) * r.height;
      const inside = x > 10 && x < r.width - 10 && y > 10 && y < r.height - 10;
      const show = !behind && inside;
      if (show !== s.visible) {
        s.visible = show;
        s.el.dataset.offstage = String(!show);
      }
      if (show) s.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }

    // Reflection last in the tick, so it mirrors the camera we just moved.
    refl?.update(scene, camera);
  });

  // The canvas is sized by the hero's own layout, so a window resize is not the
  // only thing that changes it.
  new ResizeObserver(() => engine.resize()).observe(stage);

  // Stop burning a GPU on a scene nobody is looking at.
  new IntersectionObserver(([e]) => { engine.paused = !e.isIntersecting; }, { threshold: 0.01 }).observe(stage);

  // A handle for checking framing and performance from the console. The engine
  // already publishes window.__fps; this is the rest of it.
  window.__hero = { engine, scene, camera, lorry, rig, spots, select, goIdle, setDrive };

  return engine;
}
