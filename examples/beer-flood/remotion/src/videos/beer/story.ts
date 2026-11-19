// Timeline of the beer-flood short: shots timed to the Persian voice words (voice/words.json),
// story physics (vat pressure, burst, wave front) and the camera grammar measured in the
// reference study: continuous slow push-ins; symmetric ease-in-out moves ~23 f, peak ~15 px/f at 720p;
// big reframes are cuts; impacts are 7-frame kicks that flip sign every frame; no hand-held float.
// TOTAL = 1935 frames = 64.5 s (voice 64.438 s + 0.06 s tail). 720x1280, 30 fps.
export const FPS = 30;
export const TOTAL = 1935;
export const D0 = 0; // street ground level (m)
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- story physics (tau = story time in seconds) ----------------
// The burst: vat gives way at BURST (26.78 s, "یه ساعت بعد خمره منفجر شد"). The wave front starts at the
// brewery wall (z = -30) and runs down the street toward +z, ~6.5 m/s, reaching the near end by ~36 s.
export const BURST = 26.78;
export const WAVE_Z0 = -30;
export const WAVE_SPEED = 6.5;
export const waveZ = (tau: number) => WAVE_Z0 + WAVE_SPEED * Math.max(0, tau - BURST);
// wave height: 4.5 m at the burst, subsiding to ~1 m as it spreads (shot 7-8)
export const waveH = (tau: number) =>
  tau < BURST ? 0 : lin([[BURST, 4.5], [BURST + 2, 4.2], [BURST + 5, 2.4], [BURST + 9, 1.2], [BURST + 12, 0.9]], tau);
// vat pressure: 0 -> 1 as the story approaches the burst (cracks + creaks grow with it)
export const pressure = (tau: number) => lin([[12.6, 0], [17.9, 0.25], [21.9, 0.55], [26.6, 1.0], [BURST, 1.0]], tau);
// the big vat bursts: 1 before the burst, 0 after (its staves fly, the geyser takes over)
export const vatIntact = (tau: number) => (tau < BURST ? 1 : 0);
// soda-bottle analogy (shot 9, golden): the bottle is shaken 37.6-42 s, popped at ~42.5 s
export const SODA_SHAKE0 = 38.5, SODA_POP = 42.5;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Crowd = "wave" | "brewery" | "crick" | "street" | "scoop" | "dazed" | "soda" | "rebuild" | "none";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; tau: (t: number) => number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 120, light: "day", crowd: "wave", tau: (t) => t },       // hook: the wave (flash-forward)
  { id: 2, a: 120, b: 374, light: "day", crowd: "brewery", tau: (t) => t },  // setting: brewery + the giant vat
  { id: 3, a: 374, b: 535, light: "day", crowd: "crick", tau: (t) => t },    // Crick sees the slipped hoop
  { id: 4, a: 535, b: 652, light: "day", crowd: "crick", tau: (t) => t },    // the note, walks away
  { id: 5, a: 652, b: 800, light: "day", crowd: "brewery", tau: (t) => t },  // pressure builds, wood cracks
  { id: 6, a: 800, b: 997, light: "day", crowd: "wave", tau: (t) => t },     // SNAP: burst + wave down the street
  { id: 7, a: 997, b: 1058, light: "day", crowd: "scoop", tau: (t) => t },   // deadpan 1: free beer!
  { id: 8, a: 1058, b: 1124, light: "day", crowd: "dazed", tau: (t) => t },  // deadpan 2: ...free beer
  { id: 9, a: 1124, b: 1464, light: "golden", crowd: "soda", tau: (t) => t }, // explanation: shaken soda (golden)
  { id: 10, a: 1464, b: 1752, light: "day", crowd: "rebuild", tau: (t) => t }, // rule: concrete vats
  { id: 11, a: 1752, b: TOTAL, light: "day", crowd: "street", tau: (t) => t }, // callback: crane out
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 9: 8, 10: 8, 11: 8 };
export const FLASH_AT = 120;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const T = (f: number) => f / FPS;
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** dolly push: camera slides toward the look point by factor k */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** zoom push (camera stays put): tan(fov/2) shrinks by k */
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
/** a roll-only move on top of an existing framing */
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

// ---- framings (f -> camera); each pushes in from the frame its key starts ----
// shot 1 (hook): low down the street, the wave bearing down -> closer on the front
const S1a = (f: number) => dolly([4, 2.5, 26], [0, 2.2, -8], pushK(f, 0, 0.0022), { fov: 44 });
const S1b = (f: number) => dolly([2.5, 2.0, 18], [0, 2.0, -10], pushK(f, 60, 0.0025), { fov: 40, roll: -0.03 });
// shot 2 (brewery wide): high wide over the yard -> push on the giant vat
const S2a = (f: number) => zoom([0, 13, 8], [0, 4, -32], 44, pushK(f, 120, 0.0018));
const S2b = (f: number) => zoom([2, 8, -10], [0, 4.5, -30], 42, pushK(f, 240, 0.002, 0.006, 35));
const S2c = (f: number) => dolly([4.5, 3.4, -22], [0, 4.2, -30], pushK(f, 310, 0.0025), { fov: 38 });
// shot 3 (Crick + hoop): MS of Crick looking up -> CU of the slipped hoop (camera stays clear of the vat wall)
const S3a = (f: number) => dolly([4.5, 2.0, -22.5], [2.2, 1.7, -26.8], pushK(f, 374, 0.0025), { fov: 38 });
const S3b = (f: number) => dolly([2.5, 4.2, -24.5], [0, 4.6, -27.8], pushK(f, 460, 0.003), { fov: 34 });
// shot 4 (the note): Crick writing -> walks away down the yard
const S4a = (f: number) => dolly([4, 1.8, -22.5], [2.2, 1.5, -26.8], pushK(f, 535, 0.002), { fov: 38 });
const S4b = (f: number) => dolly([-3.5, 2.2, -20], [2.2, 1.6, -26.8], pushK(f, 590, 0.002), { fov: 40 });
// shot 5 (pressure): vat CU, cracks -> slow push as the wood groans
const S5a = (f: number) => dolly([2.2, 3.0, -24], [0, 3.6, -30], pushK(f, 652, 0.0022), { fov: 36 });
const S5b = (f: number) => dolly([1.0, 3.8, -25.5], [0, 4.4, -30], pushK(f, 730, 0.0018, 0.006, 30), { fov: 34, roll: 0.03 });
// shot 6 (burst): wide of the yard as the vat goes -> low chase of the wave -> wave front CU
const S6a = (f: number) => dolly([6, 10, -2], [0, 3, -26], pushK(f, 800, 0.002), { fov: 44 });
const S6b = (f: number) => dolly([4.5, 2.0, -2], [0, 1.8, -16], pushK(f, 860, 0.0025), { fov: 42, roll: -0.03 });
const S6c = (f: number) => dolly([2.0, 1.3, 8], [0, 1.6, -6], pushK(f, 930, 0.002), { fov: 38 });
// shots 7-8 (deadpan): people scooping beer / dazed in the flood, one shared low camera
const S7a = (f: number) => dolly([3.2, 1.6, 5], [-0.4, 1.0, -3], pushK(f, 997, 0.0018), { fov: 44, roll: -0.02 });
const S8a = (f: number) => dolly([2.8, 1.5, 4.5], [-0.4, 1.1, -3.5], pushK(f, 1058, 0.0018), { fov: 40, roll: 0.03 });
// shot 9 (soda analogy, golden): the bottle on a table, shake -> pop -> the vat again
const S9a = (f: number) => dolly([3.0, 1.8, 0], [0, 1.0, -6], pushK(f, 1124, 0.0016), { fov: 42 });
const S9b = (f: number) => dolly([2.2, 1.6, -1.5], [0, 1.05, -6], pushK(f, 1260, 0.002, 0.006, 30), { fov: 38 });
const S9c = (f: number) => dolly([3, 7, -12], [0, 3.5, -30], pushK(f, 1360, 0.0018), { fov: 42 });
// shot 10 (rule): concrete vats arrive -> officer points at the new vats
const S10a = (f: number) => dolly([3, 3, -14], [0.5, 1.7, -28.5], pushK(f, 1464, 0.002), { fov: 46 });
const S10b = (f: number) => dolly([2.5, 1.9, -22], [0.5, 1.7, -29], pushK(f, 1600, 0.0025), { fov: 38 });
// shot 11 (callback): street wide, strollers walking toward the camera -> crane out over the rebuilt brewery
const S11a = (f: number) => dolly([-2, 1.8, -2], [0, 1.8, 12], pushK(f, 1752, 0.002), { fov: 40 });
const S11b = (f: number) => dolly([-1.5, 2.0, 0], [0, 1.8, 10], pushK(f, 1810, 0.0015, 0.005, 32), { fov: 38 });
/** crane out: quadratic Bezier up and back over the street (gentle rise so the strollers stay readable) */
const CRANE: V3[] = [[0, 10, -12], [8, 9, -34], [0, 6, -28]];
const S11c = (f: number): Shot => {
  const a = S11b(1880), s = glide((f - 1880) / 55), r = 1 - s, [C, B, L] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * B[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 40) + (44 - (a.fov ?? 40)) * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 60, dur: 30, s: S1b },
  ],
  2: [
    { f: 120, s: S2a },
    { f: 240, dur: 20, s: S2b },
    { f: 310, dur: 24, s: S2c },
  ],
  3: [
    { f: 374, s: S3a },
    { f: 460, dur: 26, s: S3b },
  ],
  4: [
    { f: 535, s: S4a },
    { f: 590, dur: 22, s: S4b },
  ],
  5: [
    { f: 652, s: S5a },
    { f: 730, dur: 24, s: S5b },
  ],
  6: [
    { f: 800, s: S6a },
    { f: 860, cut: true, s: S6b },
    { f: 930, cut: true, s: S6c },
  ],
  7: [{ f: 997, s: S7a }],
  8: [{ f: 1058, s: S8a }],
  9: [
    { f: 1124, s: S9a },
    { f: 1260, dur: 26, s: S9b },
    { f: 1360, cut: true, s: S9c },
  ],
  10: [
    { f: 1464, s: S10a },
    { f: 1600, dur: 24, s: S10b },
  ],
  11: [
    { f: 1752, s: S11a },
    { f: 1810, dur: 28, s: S11b },
    { f: 1880, cut: true, s: S11c },
  ],
};

// impact kicks: the image offset flips sign every frame (~3 px at 720p per unit), decays to 0 in 7 f;
// they start on the first frame at/after the event. Burst at 26.78 s (f 803), wall hit ~28.5 s, wave slam ~30 s.
const KICKS: [number, number][] = [[BURST, 1.6], [28.4, 1.0], [30.1, 0.7], [SODA_POP, 0.8]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** frame at which the current key's move has finished (for picking billboard views per key, not per frame) */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 8 },    // hook wide: wave sharp, street soft behind
  { f: 120, cInf: 0 },   // brewery establishing, sharp
  { f: 310, dur: 24, cInf: 12 }, // vat push-in
  { f: 374, cInf: 10, focus: () => [0.4, 1.7, -29] }, // Crick MS, his eyes
  { f: 460, dur: 26, cInf: 14 }, // hoop CU
  { f: 535, cInf: 8, focus: () => [0.4, 1.5, -29] },  // note
  { f: 652, cInf: 12 },  // vat CU
  { f: 800, cInf: 0 },   // burst wide, readable
  { f: 997, cInf: 12, focus: () => [0, 1.0, -6] },    // scooping faces
  { f: 1058, cInf: 14, focus: () => [0, 1.1, -7] },   // dazed faces
  { f: 1124, cInf: 14 }, // soda bottle CU
  { f: 1360, cInf: 0 },  // vat again, wide
  { f: 1464, cInf: 0 },  // rebuild wide
  { f: 1600, cInf: 12, focus: () => [0.5, 1.7, -29] }, // officer MS
  { f: 1752, cInf: 0 },  // crane out, sharp
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

// ---------------- world anchor points ----------------
// brewery yard: the giant vat stands at (0, 0, -30); two smaller vats flank it.
export const VAT_BIG: V3 = [0, 0, -30];
export const VAT_L: V3 = [-5.5, 0, -31];
export const VAT_R: V3 = [5.5, 0, -31];
// soda-bottle analogy table (shot 9, golden): a small table in the yard at (0, 0, -6)
export const SODA_TABLE: V3 = [0, 0, -6];
// Crick's spot (clerk by the big vat): clear of the vat's 2.3 m radius
export const CRICK_AT: V3 = [2.2, 0, -26.8];
