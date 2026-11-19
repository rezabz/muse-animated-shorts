// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so people in step share canvases. Characters are yaw-only
// billboards shaded by cardShade(). Standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, OFFICER, KID, PARENT,
  fxNote, fxBurst, fxSplash, fxStars, fxCreak, fxBlob, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import { FPS, CRICK_AT, SODA_TABLE, BURST, SODA_SHAKE0, SODA_POP, waveZ, clamp01, smooth } from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
const ROOTS = new Set<THREE.Object3D>();

export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false;
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1280 = 720 x 1280 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1280; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false;
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design] */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
export let LNAME: "day" | "golden" = "day";
export const setLightName = (l: "day" | "golden") => { LNAME = l; };
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
const LEAD = 2 / FPS;
const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- crowd by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

const CRICK: Who = { i: 0, o: FOLK[0], okey: "crick" };
const WORKER = (i: number): Who => ({ i: 10 + i, o: FOLK[(i * 2 + 2) % 6], okey: `worker${i}` });
const TOWN = (i: number): Who => ({ i: 20 + i, o: FOLK[i % 6], okey: `town${i}` });
const OFFICER_W: Who = { i: 40, o: OFFICER, okey: "officer" };
const KID_W: Who = { i: 41, o: KID, okey: "kid" };
const PARENT_W: Who = { i: 42, o: PARENT, okey: "parent" };

/** walk phase for a person moving at speed v (m/s): ~2 steps/s */
const walkPhase = (t: number, t0: number, i: number) => ((t - t0) * 2.2 + i * 0.7) % 2;

/** Crick's walk-away path (shot 4, 19.2-21.7 s): from the vat toward the yard gate */
const crickWalk = (t: number): [number, number, number] => {
  const u = smooth((t - 19.2) / 2.5);
  return [CRICK_AT[0] - 6.5 * u, 0, CRICK_AT[2] + 8.5 * u];
};

/** the three fleeing townspeople (shot 6): start near the yard at the burst, run +z at ~5 m/s */
const fleeAt = (t: number, i: number): [number, number, number] => {
  const u = Math.max(0, t - BURST - 0.3 - i * 0.15);
  return [-2.5 + i * 2.2, 0, -8 + 5.2 * u - i * 1.2];
};

/** the three beer-scoopers (shots 7-8): standing in the flood, spread so all three fit the frame */
const scoopAt = (i: number): [number, number, number] => [-2.6 + i * 2.2, 0.05, -2.5 - (i % 2) * 1.0];

export const stageBeer = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const add = (who: Who, x: number, y: number, z: number, dx: number, dz: number, fo: FrontOpts, so: SideOpts, scale = 1) => {
    const view = viewOf(cam, x, z, dx, dz);
    out.places.push(person(cam, who, x, y, z, view, fo, so, scale));
    blob(out, x, y, z, scale);
  };
  const faceCam = (x: number, z: number): [number, number] => [cam.pos.x - x, cam.pos.z - z];

  if (id === 2) {
    const [dx, dz] = faceCam(CRICK_AT[0], CRICK_AT[2]);
    add(CRICK, CRICK_AT[0], 0, CRICK_AT[2], dx, dz, { expr: "neutral", blink: lidAt(t, 0) }, { mode: "stand", expr: "neutral", blink: lidAt(t, 0) });
    add(WORKER(0), -3, 0, -26.5, 1, 0.2, { expr: "neutral", blink: lidAt(t, 10) }, { mode: "stroll", phase: walkPhase(t, 0, 10), expr: "neutral", blink: lidAt(t, 10) });
    add(WORKER(1), 3.5, 0, -26, -1, 0.2, { expr: "smile_closed", blink: lidAt(t, 11) }, { mode: "stand", expr: "smile_closed", blink: lidAt(t, 11) });
  }
  if (id === 3) {
    const nervous = t > 14.0;
    const [dx, dz] = faceCam(CRICK_AT[0], CRICK_AT[2]);
    add(CRICK, CRICK_AT[0], 0, CRICK_AT[2], dx, dz,
      { expr: nervous ? "nervous" : "neutral", blink: lidAt(t, 0, [14.0]) },
      { mode: "stand", expr: nervous ? "nervous" : "neutral", blink: lidAt(t, 0, [14.0]) });
    if (t > 13.5) out.fx.push({ key: "creak|vat", cw: 256, ch: 256, draw: (p) => fxCreak(p, "#241726"), x: 0.8, y: 4.4, z: -27.8, w: 1.2, h: 1.2 });
  }
  if (id === 4) {
    const [wx, , wz] = crickWalk(t);
    const [dx, dz] = t < 19.2 ? faceCam(CRICK_AT[0], CRICK_AT[2]) : [-1, 1.3];
    add(CRICK, wx, 0, wz, dx, dz, { expr: "neutral", blink: lidAt(t, 0) },
      { mode: t < 19.2 ? "stand" : "march", phase: walkPhase(t, 19.2, 0), expr: "neutral", blink: lidAt(t, 0) });
    if (t < 19.2) out.fx.push({ key: "note|crick", cw: 256, ch: 256, draw: (p) => fxNote(p), x: CRICK_AT[0] + 0.5, y: 1.3, z: CRICK_AT[2] + 0.4, w: 0.7, h: 0.7 });
  }
  if (id === 5) {
    const [wx, , wz] = crickWalk(Math.min(t, 21.7));
    add(CRICK, wx, 0, wz, -1, 1.3, { expr: "neutral", blink: lidAt(t, 0) }, { mode: "march", phase: walkPhase(t, 19.2, 0), expr: "neutral", blink: lidAt(t, 0) });
    add(WORKER(1), 3.5, 0, -26, -1, 0.2, { expr: "nervous", blink: lidAt(t, 11) }, { mode: "stand", expr: "nervous", blink: lidAt(t, 11) });
    const n = t > 24 ? 2 : 1;
    for (let i = 0; i < n; i++)
      out.fx.push({ key: `creak|vat${i}`, cw: 256, ch: 256, draw: (p) => fxCreak(p, "#241726"), x: -0.6 + i * 1.4, y: 3.8 + i * 0.8, z: -27.8, w: 1.0 + i * 0.3, h: 1.0 + i * 0.3 });
  }
  if (id === 6) {
    for (let i = 0; i < 3; i++) {
      const [x, y, z] = fleeAt(t, i);
      add(TOWN(i), x, y, z, 0, 1, { expr: "shock", blink: lidAt(t, 20 + i) },
        { mode: "march", phase: walkPhase(t, BURST, 20 + i), stride: 1.6, expr: "shock", blink: lidAt(t, 20 + i) });
    }
    if (t > BURST && t < BURST + 2.5)
      out.fx.push({ key: "burst|vat", cw: 512, ch: 512, draw: (p) => fxBurst(p), x: 0, y: 3.5, z: -29.5, w: 9, h: 9 });
    if (t > BURST)
      out.fx.push({ key: "splash|wave", cw: 512, ch: 512, draw: (p) => fxSplash(p), x: 0, y: 1.5, z: waveZ(t) - 1, w: 7, h: 4 });
  }
  if (id === 7) {
    for (let i = 0; i < 3; i++) {
      const [x, y, z] = scoopAt(i);
      const [dx, dz] = faceCam(x, z);
      add(TOWN(i), x, y, z, dx, dz, { expr: i === 1 ? "laugh" : "grin", blink: lidAt(t, 20 + i) }, { mode: "stand", expr: i === 1 ? "laugh" : "grin", blink: lidAt(t, 20 + i) });
    }
  }
  if (id === 8) {
    for (let i = 0; i < 3; i++) {
      const [x, y, z] = scoopAt(i);
      const [dx, dz] = faceCam(x, z);
      add(TOWN(i), x, y, z, dx, dz, { expr: "dazed", blink: lidAt(t, 20 + i, [35.4]) }, { mode: "stand", expr: "dazed", blink: lidAt(t, 20 + i, [35.4]) });
    }
  }
  if (id === 9) {
    const shaking = t >= SODA_SHAKE0 && t < SODA_POP;
    const pose = shaking ? 0.5 + 0.5 * Math.sin(t * 14) : 0.5;
    add(KID_W, SODA_TABLE[0] + 0.7, 0, SODA_TABLE[2] + 0.6, -1, -0.4,
      { expr: shaking ? "grin" : "neutral", blink: lidAt(t, 41) },
      { mode: "push", pose, hand: [330, 420], expr: shaking ? "grin" : "neutral", blink: lidAt(t, 41) }, 0.8);
    add(PARENT_W, SODA_TABLE[0] - 1.8, 0, SODA_TABLE[2] + 0.2, 1, -0.3,
      { expr: "smile_closed", blink: lidAt(t, 42) }, { mode: "stand", expr: "smile_closed", blink: lidAt(t, 42) });
    if (t >= SODA_POP && t < SODA_POP + 1.2)
      out.fx.push({ key: "burst|soda", cw: 256, ch: 256, draw: (p) => fxBurst(p), x: SODA_TABLE[0], y: 1.4, z: SODA_TABLE[2], w: 2.2, h: 2.2 });
    if (t >= SODA_POP && t < SODA_POP + 0.8)
      out.fx.push({ key: "stars|soda", cw: 256, ch: 256, draw: (p) => fxStars(p), x: SODA_TABLE[0], y: 1.8, z: SODA_TABLE[2], w: 1.6, h: 1.6 });
  }
  if (id === 10) {
    add(OFFICER_W, 0.5, 0, -28.5, 0, 1, { expr: "stern", blink: lidAt(t, 40) }, { mode: "stand", expr: "stern", blink: lidAt(t, 40) });
    add(WORKER(0), -2.5, 0, -27, 1, 0.3, { expr: "neutral", blink: lidAt(t, 10) },
      { mode: "push", pose: 0.5 + 0.5 * Math.sin(t * 3), hand: [330, 700], expr: "neutral", blink: lidAt(t, 10) });
    add(WORKER(1), 3, 0, -27, -1, 0.3, { expr: "neutral", blink: lidAt(t, 11) },
      { mode: "push", pose: 0.5 + 0.5 * Math.sin(t * 3 + 1), hand: [330, 700], expr: "neutral", blink: lidAt(t, 11) });
  }
  if (id === 11) {
    for (let i = 0; i < 4; i++) {
      const z = -2 + i * 5 + ((t - 58.4) * 0.8);
      add(TOWN(i), -2 + (i % 2) * 3.5, 0, Math.min(z, 16), 0, 1,
        { expr: "smile_closed", blink: lidAt(t, 20 + i) },
        { mode: "march", phase: walkPhase(t, 58.4, 20 + i), expr: "smile_closed", blink: lidAt(t, 20 + i) });
    }
  }
  return out;
};
