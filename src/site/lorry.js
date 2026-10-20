// A tractor unit and curtainside trailer, built from geometry rather than loaded.
//
// Dioramas generates its hero objects (prompt -> Nano Banana -> Meshy), but there is no
// lorry in its model library and a fleet-software page cannot very well lead with a
// croissant. So the subject is procedural. Everything is in metres with the ground at
// y = 0, the lorry pointing down +X, and the nose at about x = +6.3 — roughly a 16.5 m
// artic, which is what the plates on the demo fleet are attached to.
//
// What the page drives afterwards:
//   - `livery`      the cab and trailer band colour (the licensee's colour)
//   - `printName()` reprints the curtain canvas, so a typed brand name appears on the side
//   - `anchors`     empty Object3Ds the HTML hotspot cards are projected from
//   - `wheels`      spun by the drive toggle
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { fbmNormal, bakeTexture } from '../core/textures.js';

const DEG = Math.PI / 180;

// Dimensions in one place: the proportions are what make it read as a lorry rather
// than a bus, and they get fiddled with a lot.
const D = {
  width: 2.50,
  // A sleeper cab is about 2.7 m front to back. Longer than that and the thing
  // stops reading as a tractor unit and starts reading as a box van.
  cab: { x0: 3.56, x1: 6.30, y0: 0.94, y1: 3.56 },
  chassis: { x0: 1.75, x1: 6.20, y: 0.86, h: 0.20 },
  trailer: { x0: -10.10, x1: 2.62, y0: 1.32, y1: 4.00, w: 2.55 },
  wheelR: 0.52,
  tyreW: 0.34,
  // Steer axle, tandem drive axles, then the trailer tri-axle bogie at the back.
  axles: [5.08, 2.72, 1.90, -6.55, -7.75, -8.95],
};

/** A flat-ish panel: a box with its corners taken off, which catches a highlight. */
const panel = (w, h, d, r = 0.06, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - 1e-3));

export function buildLorry(renderer) {
  const root = new THREE.Group();
  const aniso = renderer.capabilities.getMaxAnisotropy();

  // ── Materials ───────────────────────────────────────────────────────────────
  // The livery colour is overwritten live, so it is the one material the page keeps
  // a reference to. Everything else is fixed.
  const livery = new THREE.MeshStandardMaterial({
    color: 0x5b4bff, roughness: 0.33, metalness: 0.12, envMapIntensity: 0.9,
  });
  const liveryDark = new THREE.MeshStandardMaterial({ color: 0x3a2fb0, roughness: 0.46, metalness: 0.1 });

  const glass = new THREE.MeshStandardMaterial({
    color: 0x0c131b, roughness: 0.05, metalness: 0.55, envMapIntensity: 2.6,
  });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.16, metalness: 1 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x5a636c, roughness: 0.45, metalness: 0.85 });
  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x1b2027, roughness: 0.6, metalness: 0.6 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x15191f, roughness: 0.68, metalness: 0.1 });

  // Tyres get a real normal map: at hero framing the tread is visible and a smooth
  // black cylinder is the single thing that most makes a scene look untextured.
  const treadN = fbmNormal(renderer, { size: 512, scale: 26, octaves: 4, strength: 1.5 });
  treadN.anisotropy = aniso;
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x0e1013, roughness: 0.88, metalness: 0.02, normalMap: treadN,
    normalScale: new THREE.Vector2(0.7, 0.7),
  });
  rubber.normalMap.wrapS = rubber.normalMap.wrapT = THREE.RepeatWrapping;
  rubber.normalMap.repeat.set(8, 2);

  const lampWhite = new THREE.MeshStandardMaterial({
    color: 0xfff6e2, emissive: 0xfff1d6, emissiveIntensity: 3.2, roughness: 0.3, metalness: 0,
  });
  const lampRed = new THREE.MeshStandardMaterial({
    color: 0x8c1510, emissive: 0xff2a18, emissiveIntensity: 2.0, roughness: 0.35, metalness: 0,
  });
  const lampAmber = new THREE.MeshStandardMaterial({
    color: 0x9a5a08, emissive: 0xffaa22, emissiveIntensity: 1.4, roughness: 0.35, metalness: 0,
  });

  // ── The curtain: an off-white canvas the brand name is printed onto ──────────
  // 2048x512 is enough for the name to stay crisp when the camera comes in close.
  const curtainCv = document.createElement('canvas');
  curtainCv.width = 2048; curtainCv.height = 512;
  const curtainTex = new THREE.CanvasTexture(curtainCv);
  curtainTex.colorSpace = THREE.SRGBColorSpace;
  curtainTex.anisotropy = aniso;
  const curtain = new THREE.MeshStandardMaterial({
    map: curtainTex, roughness: 0.72, metalness: 0.02, envMapIntensity: 0.7,
  });

  // Vertical ribs, so the curtain creases like tensioned PVC instead of reading as
  // a painted box. Baked once; the colour canvas above rides on top of it.
  const curtainN = bakeTexture(renderer, 1024, `
    void main(){
      // Tensioned curtains crease on a regular pitch, with slack between the buckles.
      float ribs = sin(vUv.x * 190.0) * 0.5 + 0.5;
      float slack = fbm(vUv * vec2(6.0, 2.0), 6.0, 4, 0.5);
      float h = ribs * 0.55 + slack * 0.45;
      float e = 1.0 / 1024.0;
      float hx = (sin((vUv.x + e) * 190.0) - sin((vUv.x - e) * 190.0)) * 0.5 * 0.55;
      vec3 n = normalize(vec3(-hx * 1024.0 * 0.02 * 1.6, -0.02, 1.0));
      gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
    }`);
  curtainN.anisotropy = aniso;
  curtain.normalMap = curtainN;
  curtain.normalScale = new THREE.Vector2(0.45, 0.45);

  let brand = { name: 'Your Fleet', colour: '#5b4bff', ink: '#ffffff' };

  /** Redraw the curtain canvas. Called on every keystroke, so it must stay cheap. */
  function printName(name = brand.name, colour = brand.colour, ink = brand.ink) {
    brand = { name: name || 'Your Fleet', colour, ink };
    const c = curtainCv.getContext('2d');
    const W = curtainCv.width, H = curtainCv.height;

    // Curtain body: a warm off-white, not pure white, or it blows out under the lamps.
    c.fillStyle = '#dcd9d2';
    c.fillRect(0, 0, W, H);

    // A faint vertical ribbing in the albedo as well — the normal map alone does not
    // survive the AgX roll-off at this distance.
    c.globalAlpha = 0.055;
    c.fillStyle = '#000';
    for (let x = 0; x < W; x += 11) c.fillRect(x, 0, 4, H);
    c.globalAlpha = 1;

    // The licensee's colour, as the band along the bottom of the curtain.
    c.fillStyle = colour;
    c.fillRect(0, H * 0.70, W, H * 0.30);
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.fillRect(0, H * 0.70, W, 5);

    // The name. Shrink to fit rather than overflow: someone will type 22 characters.
    const label = brand.name.toUpperCase();
    c.fillStyle = '#14181d';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    let size = 170;
    do {
      c.font = `800 ${size}px Archivo, "Helvetica Neue", Arial, sans-serif`;
      size -= 4;
    } while (c.measureText(label).width > W * 0.80 && size > 40);
    c.fillText(label, W * 0.5, H * 0.345);

    // Strapline inside the colour band, in whichever of black/white reads on it.
    c.fillStyle = ink;
    c.font = '500 46px "IBM Plex Mono", ui-monospace, Consolas, monospace';
    c.globalAlpha = 0.92;
    c.fillText('TRACKING  ·  DASHCAM  ·  TACHOGRAPH  COMPLIANCE', W * 0.5, H * 0.845);
    c.globalAlpha = 1;

    curtainTex.needsUpdate = true;
  }
  printName();

  // ── Chassis ─────────────────────────────────────────────────────────────────
  const unit = new THREE.Group();          // tractor unit: steers, and the cab tilts on it
  const trailerG = new THREE.Group();      // trailer: pivots a little at the fifth wheel
  root.add(unit, trailerG);

  const railLen = D.chassis.x1 - D.chassis.x0;
  for (const z of [-0.42, 0.42]) {
    const rail = new THREE.Mesh(panel(railLen, D.chassis.h, 0.13, 0.03), chassisMat);
    rail.position.set((D.chassis.x0 + D.chassis.x1) / 2, D.chassis.y, z);
    unit.add(rail);
  }
  const crossA = new THREE.Mesh(panel(0.9, 0.12, 0.84, 0.03), chassisMat);
  crossA.position.set(2.45, D.chassis.y, 0);
  unit.add(crossA);

  // Fifth wheel: the plate the trailer sits on. Visible from the hero angle.
  const fifth = new THREE.Mesh(panel(1.25, 0.09, 1.5, 0.04), steel);
  fifth.position.set(2.42, 1.02, 0);
  unit.add(fifth);

  // Chassis furniture between the cab and the drive axles. Without it the gap
  // behind the cab is a hole, and the cab reads as a box floating over wheels.
  for (const z of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 1.05, 16), chrome);
    tank.rotation.z = 90 * DEG;
    tank.position.set(3.05, 0.70, z * 1.08);
    unit.add(tank);
    // Strap bands round the tank.
    for (const bx of [2.75, 3.35]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.022, 6, 16), steel);
      band.rotation.y = 90 * DEG;
      band.position.set(bx, 0.70, z * 1.08);
      unit.add(band);
    }
    // Catwalk over the chassis, and the side skirt that fills the rest.
    const skirt = new THREE.Mesh(panel(1.30, 0.52, 0.07, 0.04), livery);
    skirt.position.set(3.05, 1.22, z * (D.width / 2 - 0.06));
    unit.add(skirt);
  }
  const battery = new THREE.Mesh(panel(0.62, 0.40, 0.56, 0.04), plastic);
  battery.position.set(2.05, 0.72, -0.86);
  unit.add(battery);
  const catwalk = new THREE.Mesh(panel(1.0, 0.05, 1.6, 0.02), steel);
  catwalk.position.set(2.95, 1.02, 0);
  unit.add(catwalk);

  // ── Cab ─────────────────────────────────────────────────────────────────────
  const cabW = D.cab.x1 - D.cab.x0, cabH = D.cab.y1 - D.cab.y0;
  const cab = new THREE.Group();
  cab.position.set((D.cab.x0 + D.cab.x1) / 2, (D.cab.y0 + D.cab.y1) / 2, 0);
  unit.add(cab);

  const cabShell = new THREE.Mesh(panel(cabW, cabH, D.width, 0.22, 4), livery);
  cab.add(cabShell);

  // Windscreen: deep and nearly full width, raked back. This is the single
  // feature that decides whether the front reads as a cab or as a crate.
  const screen = new THREE.Mesh(panel(0.09, 1.16, D.width - 0.17, 0.04), glass);
  screen.position.set(cabW / 2 - 0.045, 0.74, 0);
  screen.rotation.z = -11 * DEG;
  cab.add(screen);
  // Black band below the screen, where the wiper park and the badge sit.
  const screenSill = new THREE.Mesh(panel(0.08, 0.17, D.width - 0.20, 0.03), plastic);
  screenSill.position.set(cabW / 2 - 0.015, 0.08, 0);
  cab.add(screenSill);
  for (const z of [-0.5, 0.42]) {
    const wiper = new THREE.Mesh(panel(0.025, 0.03, 0.82, 0.01), plastic);
    wiper.position.set(cabW / 2 + 0.015, 0.20, z);
    wiper.rotation.x = 8 * DEG;
    cab.add(wiper);
  }

  // Side glass, one per door: high in the door, not a porthole in the middle.
  for (const z of [-1, 1]) {
    const side = new THREE.Mesh(panel(1.02, 0.66, 0.06, 0.03), glass);
    side.position.set(0.52, 0.62, z * (D.width / 2 - 0.02));
    cab.add(side);
    // The low vision window every modern cab has in the passenger door.
    const vision = new THREE.Mesh(panel(0.42, 0.34, 0.05, 0.03), glass);
    vision.position.set(0.86, -0.02, z * (D.width / 2 - 0.02));
    cab.add(vision);

    // Door shut line + handle, so the flank is not a blank slab.
    const shut = new THREE.Mesh(panel(0.018, cabH - 0.56, 0.014, 0.006), liveryDark);
    shut.position.set(-0.10, -0.18, z * (D.width / 2 + 0.005));
    cab.add(shut);
    const handle = new THREE.Mesh(panel(0.20, 0.055, 0.05, 0.02), chrome);
    handle.position.set(0.30, 0.12, z * (D.width / 2 + 0.03));
    cab.add(handle);
    // Step into the cab, under the door.
    for (let i = 0; i < 2; i++) {
      const step = new THREE.Mesh(panel(0.44, 0.045, 0.14, 0.02), steel);
      step.position.set(0.52, -cabH / 2 - 0.10 - i * 0.26, z * (D.width / 2 - 0.02));
      cab.add(step);
    }

    // Mirror arm and head.
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 10), steel);
    arm.rotation.x = 90 * DEG;
    arm.position.set(cabW / 2 - 0.22, 0.60, z * (D.width / 2 + 0.22));
    cab.add(arm);
    const head = new THREE.Mesh(panel(0.10, 0.34, 0.18, 0.04), plastic);
    head.position.set(cabW / 2 - 0.22, 0.52, z * (D.width / 2 + 0.44));
    cab.add(head);
  }

  // Sun visor: the strip above the screen a fleet normally puts its name on. Left
  // plain here — the curtain is where the brand goes, and two decals look cheap.
  const visor = new THREE.Mesh(panel(0.34, 0.26, D.width + 0.02, 0.06), livery);
  visor.position.set(cabW / 2 - 0.12, cabH / 2 - 0.02, 0);
  visor.rotation.z = -11 * DEG;
  cab.add(visor);

  // Grille, bumper, headlights, foglights.
  const grille = new THREE.Mesh(panel(0.10, 0.54, D.width - 0.44, 0.04), plastic);
  grille.position.set(cabW / 2 + 0.005, -0.44, 0);
  cab.add(grille);
  for (let i = 0; i < 5; i++) {
    const slat = new THREE.Mesh(panel(0.04, 0.045, D.width - 0.52, 0.015), chrome);
    slat.position.set(cabW / 2 + 0.045, -0.26 - i * 0.105, 0);
    cab.add(slat);
  }
  const bumper = new THREE.Mesh(panel(0.26, 0.34, D.width + 0.04, 0.07), plastic);
  bumper.position.set(cabW / 2 + 0.02, -cabH / 2 + 0.10, 0);
  cab.add(bumper);

  const headlamps = [];
  for (const z of [-1, 1]) {
    const lamp = new THREE.Mesh(panel(0.07, 0.19, 0.46, 0.04), lampWhite);
    lamp.position.set(cabW / 2 + 0.11, -cabH / 2 + 0.26, z * 0.82);
    cab.add(lamp);
    headlamps.push(lamp);
    const fog = new THREE.Mesh(panel(0.05, 0.10, 0.20, 0.03), lampAmber);
    fog.position.set(cabW / 2 + 0.12, -cabH / 2 + 0.03, z * 0.44);
    cab.add(fog);
  }

  // Air dam and the exhaust stack behind the cab.
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.5, 12), chrome);
  stack.position.set(D.cab.x0 - (D.cab.x0 + D.cab.x1) / 2 + 0.04, -0.2, -(D.width / 2 - 0.16));
  cab.add(stack);

  // Roof fairing, and the roof beacon bar.
  const fairing = new THREE.Mesh(panel(cabW * 0.52, 0.30, D.width - 0.1, 0.1), livery);
  fairing.position.set(-cabW * 0.20, cabH / 2 + 0.12, 0);
  cab.add(fairing);
  const beacons = [];
  for (const z of [-0.62, 0.62]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lampAmber);
    b.position.set(cabW / 2 - 0.42, cabH / 2 + 0.12, z);
    cab.add(b);
    beacons.push(b);
  }

  // ── Trailer ─────────────────────────────────────────────────────────────────
  const T = D.trailer;
  const tLen = T.x1 - T.x0, tHgt = T.y1 - T.y0;
  const body = new THREE.Group();
  body.position.set((T.x0 + T.x1) / 2, (T.y0 + T.y1) / 2, 0);
  trailerG.add(body);

  // The curtain sides carry the brand; the roof, front bulkhead and rear frame
  // are separate so the canvas texture is not stretched around corners.
  for (const z of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(tLen - 0.12, tHgt - 0.16), curtain);
    side.position.set(0, 0, z * (T.w / 2));
    side.rotation.y = z > 0 ? 0 : Math.PI;
    body.add(side);
  }
  // A thin core behind the curtains, so the trailer is solid from any angle.
  const core = new THREE.Mesh(panel(tLen, tHgt, T.w - 0.03, 0.04), liveryDark);
  body.add(core);
  const roof = new THREE.Mesh(panel(tLen, 0.10, T.w + 0.04, 0.03), new THREE.MeshStandardMaterial({ color: 0xb4b1aa, roughness: 0.68, metalness: 0.08 }));
  roof.position.set(0, tHgt / 2 + 0.02, 0);
  body.add(roof);
  for (const x of [-1, 1]) {
    const rail = new THREE.Mesh(panel(0.09, tHgt, T.w + 0.05, 0.03), steel);
    rail.position.set(x * (tLen / 2 - 0.03), 0, 0);
    body.add(rail);
  }
  // Rear frame, doors and lamps.
  const rearDoor = new THREE.Mesh(panel(0.10, tHgt - 0.2, T.w - 0.1, 0.03), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.42, metalness: 0.7 }));
  rearDoor.position.set(-tLen / 2 - 0.02, 0, 0);
  body.add(rearDoor);
  const tails = [];
  for (const z of [-1, 1]) {
    const t = new THREE.Mesh(panel(0.06, 0.16, 0.34, 0.03), lampRed);
    t.position.set(-tLen / 2 - 0.08, -tHgt / 2 + 0.22, z * 0.92);
    body.add(t);
    tails.push(t);
  }

  // Trailer chassis, landing legs, underrun bar, side guards.
  const tChassis = new THREE.Mesh(panel(tLen - 0.3, 0.17, 1.0, 0.04), chassisMat);
  tChassis.position.set((T.x0 + T.x1) / 2, T.y0 - 0.10, 0);
  trailerG.add(tChassis);
  for (const z of [-1, 1]) {
    const leg = new THREE.Mesh(panel(0.14, 0.78, 0.14, 0.03), steel);
    leg.position.set(0.72, T.y0 - 0.56, z * 0.80);
    trailerG.add(leg);
    // Side guard rails along the bogie, which every UK trailer has to have.
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Mesh(panel(4.1, 0.10, 0.07, 0.025), steel);
      g.position.set(-3.9, T.y0 - 0.22 - i * 0.26, z * (T.w / 2 - 0.05));
      trailerG.add(g);
    }
  }
  const underrun = new THREE.Mesh(panel(0.09, 0.14, T.w - 0.3, 0.03), steel);
  underrun.position.set(T.x0 + 0.1, 0.56, 0);
  trailerG.add(underrun);

  // ── Wheels ──────────────────────────────────────────────────────────────────
  // One tyre geometry reused: six axles, twinned on everything but the steer axle.
  const tyreGeo = new THREE.CylinderGeometry(D.wheelR, D.wheelR, D.tyreW, 28, 1);
  const rimGeo = new THREE.CylinderGeometry(D.wheelR * 0.56, D.wheelR * 0.56, D.tyreW + 0.02, 20, 1);
  const hubGeo = new THREE.CylinderGeometry(D.wheelR * 0.17, D.wheelR * 0.17, D.tyreW + 0.08, 12);
  const wheels = [];

  function addWheel(x, z, parent) {
    const g = new THREE.Group();
    g.position.set(x, D.wheelR, z);
    const tyre = new THREE.Mesh(tyreGeo, rubber);
    tyre.rotation.x = 90 * DEG;
    const rim = new THREE.Mesh(rimGeo, chrome);
    rim.rotation.x = 90 * DEG;
    const hub = new THREE.Mesh(hubGeo, steel);
    hub.rotation.x = 90 * DEG;
    g.add(tyre, rim, hub);
    parent.add(g);
    wheels.push(g);
    return g;
  }

  for (const x of D.axles) {
    const onTrailer = x < 1.2;
    const parent = onTrailer ? trailerG : unit;
    const steer = x > 4.5;                      // steer axle runs singles
    const offsets = steer ? [0.98] : [0.80, 1.18];
    for (const z of [-1, 1]) for (const o of offsets) addWheel(x, z * o, parent);
    // Mudguard over each axle group.
    const guard = new THREE.Mesh(new THREE.TorusGeometry(D.wheelR + 0.1, 0.05, 6, 14, Math.PI * 0.62), chassisMat);
    guard.rotation.set(0, 90 * DEG, 25 * DEG);
    guard.position.set(x, D.wheelR + 0.06, 0);
    if (!steer) parent.add(guard);
  }

  // ── Hotspot anchors ─────────────────────────────────────────────────────────
  // Empty objects the page projects HTML cards from, and raycasts small spheres at.
  // Placed on the actual hardware each one talks about.
  const anchors = {};
  const mkAnchor = (key, parent, pos) => {
    const a = new THREE.Object3D();
    a.position.set(...pos);
    parent.add(a);
    anchors[key] = a;
    return a;
  };

  // The telematics unit: a real one is a box behind the roof fairing with a stub aerial.
  const trackerBox = new THREE.Mesh(panel(0.34, 0.09, 0.26, 0.03), plastic);
  trackerBox.position.set(-cabW * 0.30, cabH / 2 + 0.30, 0.30);
  cab.add(trackerBox);
  const aerial = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.30, 8), plastic);
  aerial.position.set(-cabW * 0.30, cabH / 2 + 0.47, 0.30);
  cab.add(aerial);
  mkAnchor('tracker', cab, [-cabW * 0.30, cabH / 2 + 0.56, 0.30]);

  // The forward dashcam, behind the glass at the top of the windscreen.
  const camPod = new THREE.Mesh(panel(0.16, 0.10, 0.20, 0.035), plastic);
  camPod.position.set(cabW / 2 - 0.20, 0.90, 0.26);
  cab.add(camPod);
  const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.04, 10), glass);
  camLens.rotation.z = 90 * DEG;
  camLens.position.set(cabW / 2 - 0.12, 0.88, 0.26);
  cab.add(camLens);
  mkAnchor('dashcam', cab, [cabW / 2 + 0.02, 0.96, 0.30]);

  // The tachograph lives in the dash, so the anchor sits at the driver's door —
  // the nearest thing you can actually point at from outside the cab.
  mkAnchor('tacho', cab, [0.30, 0.18, D.width / 2 + 0.10]);

  // The curtain, as the white-label point itself.
  mkAnchor('brand', body, [1.1, 0.30, T.w / 2 + 0.05]);

  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  // Lamps must not cast: a shadow from an emissive block reads as a hole.
  for (const l of [...headlamps, ...tails, ...beacons]) l.castShadow = false;

  return {
    root, unit, trailerG, cab, body, wheels, anchors,
    materials: { livery, liveryDark, curtain, glass, chrome, steel, lampWhite, lampRed, lampAmber },
    headlamps, tails, beacons,
    printName,
    /** Set the livery colour and reprint the curtain band to match. */
    setBrand(colourHex, name, inkHex) {
      livery.color.set(colourHex);
      liveryDark.color.set(colourHex).multiplyScalar(0.52);
      printName(name, colourHex, inkHex);
    },
    dims: D,
  };
}
