# Original light comedic military march for the beer-flood short, composed and synthesized here (Bb major, 120 bpm:
# one quarter note = one footfall, the beat grid t = k * 0.5 s). Sections follow the picture: hook tutti (the wave
# flash-forward) | setting march (the brewery) | tension climb as the vat strains (dead stop on the burst) |
# (silence through the burst, the wave and the deadpan joke) | warm music-box waltz for the soda analogy (golden) |
# rule march (concrete vats) | lazy swung callback ending on the last word.
import numpy as np
from dsp import SR, ns, rng, pan, place, fades, dbg, make_ir, convolve_st, integrated, lp, hp
import instruments as I
import timeline as T

N = ns(T.DUR)
Q = 0.5  # quarter note (s)

# theme B (beer): a rising-fourths beer-hall march, 8 bars in Bb
THEME = [
    (1, 0, 1, 77), (1, 1, 1, 82), (1, 2, 1, 86), (1, 3, 1, 84),
    (2, 0, 2, 82), (2, 2, 1, 77), (2, 3, 1, 79),
    (3, 0, 1, 81), (3, 1, 1, 82), (3, 2, 1, 84), (3, 3, 1, 86),
    (4, 0, 2, 87), (4, 2, 1, 86), (4, 3, 1, 84),
    (5, 0, 1, 82), (5, 1, 1, 86), (5, 2, 1, 89), (5, 3, 1, 87),
    (6, 0, 2, 86), (6, 2, 1, 84), (6, 3, 1, 82),
    (7, 0, 1, 84), (7, 1, 1, 86), (7, 2, 1, 87), (7, 3, 1, 89),
    (8, 0, 2, 87), (8, 2, 1, 86), (8, 3, 1, 82),
]
CHB = {1: ["Bb"] * 4, 2: ["Bb"] * 4, 3: ["Cm", "Cm", "Eb", "Eb"], 4: ["F7"] * 4, 5: ["Bb"] * 4,
       6: ["Eb", "Eb", "F", "F"], 7: ["Gm", "Gm", "Cm", "F7"], 8: ["F7", "F7", "Bb", "Bb"]}
CH = {
    "Bb": dict(oom=(34, 41), pah=[53, 58, 62], hi=[58, 62, 65]),
    "F": dict(oom=(41, 36), pah=[53, 57, 60], hi=[57, 60, 65]),
    "F7": dict(oom=(41, 36), pah=[51, 57, 60], hi=[57, 60, 63]),
    "Cm": dict(oom=(36, 43), pah=[55, 60, 63], hi=[60, 63, 67]),
    "Eb": dict(oom=(39, 46), pah=[55, 58, 63], hi=[58, 63, 67]),
    "Gm": dict(oom=(43, 38), pah=[55, 58, 62], hi=[58, 62, 67]),
    "F#o7": dict(oom=(42, 42), pah=[54, 57, 60, 63], hi=[57, 60, 63]),
    "G#o7": dict(oom=(44, 44), pah=[56, 59, 62, 65], hi=[59, 62, 65]),
}
F = I.m2f

SECTIONS = [
    ("hook", 0.0, T.FLASH), ("setting", T.FLASH, 12.45), ("tension", 12.45, T.BURST),
    ("dropout", T.BURST, 37.59), ("soda", 37.59, 48.78), ("rule", 48.78, 58.37), ("callback", 58.37, T.DUR),
]


def swingb(b):
    fl = np.floor(b)
    fr_ = b - fl
    return fl + (2 / 3 if fr_ in (0.5, 0.75) else (1 / 3 if fr_ == 0.25 else fr_))


def theme(t_bar1, bars=range(1, 9), transpose=0, pickup=False, swing=False, late=0.0):
    ev = []
    for (b, beat, d, m) in THEME:
        if b not in bars:
            continue
        bb = swingb(beat) if swing else beat
        ev.append((t_bar1 + (b - 1) * 4 * Q + bb * Q + late, d * Q, m + transpose))
    return sorted(ev)


class Band:
    def __init__(self):
        self.tr = {}
        self.send = {}
        self.cues = []

    def track(self, name, send):
        if name not in self.tr:
            self.tr[name] = np.zeros((2, N))
            self.send[name] = send
        return self.tr[name]

    def add(self, name, x, t, p=0.0, g=1.0, send=0.15):
        buf = self.track(name, send)
        place(buf, pan(x, p) if np.ndim(x) == 1 else x, t, g)


R = rng(1831)


def _r():
    return rng(int(R.integers(1 << 30)))


def oompah(b, t_bar, chords, vel=0.6, every=True, pah_vel=0.4, bounce=False, pah=True):
    """tuba on the beats (root/fifth alternating) + after-beat horns on the &s; bounce = octave eighths"""
    for beat in range(4):
        c = CH[chords[beat]]
        t = t_bar + beat * Q
        if bounce:
            lo = c["oom"][0] if c["oom"][0] >= 36 else c["oom"][0] + 12
            b.add("tuba", I.brass(F(lo), 0.2, vel, _r(), "tuba", scoop=-30), t, -0.1)
            b.add("tuba", I.brass(F(lo + 12), 0.16, vel * 0.85, _r(), "tuba", scoop=-45), t + Q / 2, -0.1)
        elif every or beat in (0, 2):
            m = c["oom"][beat % 2] if every else c["oom"][0 if beat == 0 else 1]
            b.add("tuba", I.brass(F(m), 0.3, vel * (1.0 if beat in (0, 2) else 0.88), _r(), "tuba"), t, -0.1)
        if pah:
            if every:
                for k, m in enumerate(c["pah"]):
                    b.add("pah", I.brass(F(m), 0.15, pah_vel, _r(), "horn", scoop=-12), t + Q / 2 + 0.004 * k, 0.32 - 0.12 * k)
            elif beat in (1, 3):
                for k, m in enumerate(c["pah"]):
                    b.add("pah", I.brass(F(m), 0.17, pah_vel, _r(), "horn", scoop=-12), t + 0.004 * k, 0.32 - 0.12 * k)


SN = {
    "light": [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 1],
    "march": [3, 0, 1, 1, 2, 0, 1, 0, 3, 0, 1, 1, 2, 0, 1, 0],
    "drive": [2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1],
}


def snare_bar(b, t_bar, pat, vel, steps=range(16), cres=0.0):
    for s in steps:
        v = SN[pat][s]
        if not v:
            continue
        t = t_bar + s * Q / 4
        vv = vel * (1 + cres * s / 16) * {1: 0.5, 2: 0.9, 3: 0.95}[v] * R.uniform(0.93, 1.05)
        if v == 3:
            b.add("snare", I.snare(vv * 0.4, _r()), t - 0.026, 0.05)
        b.add("snare", I.snare(vv, _r()), t + R.normal(0, 0.002), 0.05)


def roll(b, t0, t1, v0, v1, accent=None, at=None):
    for t, v in I.snare_roll(t0, t1, v0, v1, _r()):
        b.add("snare", I.snare(v, _r(), dur=0.14, buzz=True), t, 0.05)
    if accent:
        at = t1 if at is None else at
        b.add("snare", I.snare(accent * 0.4, _r()), at - 0.026, 0.05)
        b.add("snare", I.snare(accent, _r()), at, 0.05)


def melody(b, name, notes, vel, transpose=0, fn="glock", p=0.0, gate=0.9):
    for (t, d, m) in notes:
        m = m + transpose
        if fn == "glock":
            x = I.glock(F(m), vel * R.uniform(0.92, 1.05), _r())
        elif fn == "fife":
            x = I.fife(F(m), d * gate, vel * R.uniform(0.94, 1.04), _r())
        elif fn == "vibes":
            x = I.vibes(F(m), vel * R.uniform(0.92, 1.05), _r(), dur=max(1.2, d + 0.8), damp=d + 0.35)
        elif fn == "musicbox":
            x = I.musicbox(F(m), vel * R.uniform(0.92, 1.05), _r())
        b.add(name, x, t, p)


def build():
    b = Band()
    for name, send in [("whistle", 0.0), ("fife", 0.16), ("glock", 0.22), ("tuba", 0.10), ("pah", 0.18), ("snare", 0.13),
                       ("cymbal", 0.16), ("stab", 0.16), ("timpani", 0.18), ("pad", 0.25), ("vibes", 0.26), ("musicbox", 0.26),
                       ("pluck", 0.18), ("brush", 0.12), ("triangle", 0.25)]:
        b.track(name, send)

    # ============ HOOK 0 - 4.0: tutti march over the wave flash-forward, button hit ON the white flash
    h = theme(0.0, bars=[1, 2])
    melody(b, "glock", h, 0.5, 12, "glock", -0.35)
    melody(b, "fife", h, 0.45, 0, "fife", 0.25)
    for bar in (1, 2):
        tb = (bar - 1) * 2.0
        oompah(b, tb, CHB[bar], 0.68, True, 0.42)
        snare_bar(b, tb, "march", 0.62, steps=range(16) if bar == 1 else range(8))
    roll(b, 3.0, 3.9, 0.25, 0.62)
    b.add("cymbal", I.cymbal(0.45, _r()), 0.0, 0.0)
    b.cues.append((0.0, "hook: theme B1-B2 tutti (glock + fife, tuba/after-beats/snare); snare fill 3.0-3.9"))
    hook_cut = np.ones(N)
    a, z = ns(T.FLASH - 0.03), ns(T.FLASH + 0.015)
    hook_cut[a:z] = np.linspace(1, 0, z - a)
    hook_cut[z:] = 0
    for k in b.tr:
        b.tr[k] *= hook_cut[None, :]
    for m in [46, 53, 58, 62, 65]:
        b.add("stab", I.brass(F(m), 0.2, 0.8, _r(), "stab", scoop=-15), T.FLASH, (m - 56) / 20)
    b.add("tuba", I.brass(F(34), 0.25, 0.8, _r(), "tuba"), T.FLASH, -0.1)
    b.add("glock", I.glock(F(94), 0.6, _r()), T.FLASH, -0.35)
    b.add("cymbal", I.cymbal(0.4, _r(), dur=1.2), T.FLASH, 0.0)
    b.cues.append((T.FLASH, "Bb button + light clash exactly on the white flash (frame 120), then the band is gone"))

    # ============ SETTING 4.0 - 12.45: story march, theme B bars 1-4, light then full band
    roll(b, 4.0, 4.46, 0.15, 0.5, accent=0.55, at=4.5)
    s0 = 4.5
    a14 = theme(s0, bars=[1, 2, 3, 4])
    melody(b, "glock", a14, 0.36, 12, "glock", -0.35)
    melody(b, "fife", a14, 0.42, 0, "fife", 0.25)
    for bar in (1, 2, 3, 4):
        tb = s0 + (bar - 1) * 2
        oompah(b, tb, CHB[bar], 0.5 if bar < 3 else 0.64, bar >= 3, 0.34 if bar < 3 else 0.44)
        snare_bar(b, tb, "light" if bar < 3 else "march", 0.36 if bar < 3 else 0.58)
    b.cues.append((s0, "setting: theme B1-B4 light (glock + fife), full band from bar 3 as the vat fills the frame"))

    # ============ TENSION 12.45 - 26.78: the hoop slips, the wood strains; tuba thins to a dominant pedal,
    # chromatic climb + snare roll, DEAD STOP on the burst
    t0 = 12.5
    frag = theme(t0, bars=[5, 6])
    melody(b, "fife", frag, 0.3, 0, "fife", 0.25)
    for bar in (5, 6):
        tb = t0 + (bar - 5) * 2
        oompah(b, tb, CHB[bar], 0.5, False, 0.3)
        snare_bar(b, tb, "light", 0.3)
    b.cues.append((t0, "tension: theme B5-B6 fragment, thin (fife + tuba on 1/3), the hoop has slipped"))
    oompah(b, 16.5, ["F7"] * 4, 0.6, True, 0.4)
    snare_bar(b, 16.5, "light", 0.4)
    oompah(b, 18.5, ["F7"] * 4, 0.65, True, 0.45)
    snare_bar(b, 18.5, "march", 0.5)
    oompah(b, 20.5, ["Gm"] * 4, 0.65, True, 0.45)
    snare_bar(b, 20.5, "march", 0.55)
    oompah(b, 22.5, ["F7"] * 4, 0.7, True, 0.5)
    snare_bar(b, 22.5, "march", 0.6, steps=range(8))
    snare_bar(b, 22.5, "drive", 0.55, steps=range(8, 16), cres=0.4)
    climb = [("F7", 24.5), ("F#o7", 25.0), ("Gm", 25.5), ("G#o7", 26.0)]
    for i, (c, t) in enumerate(climb):
        m = CH[c]["oom"][0]
        for k in range(2):
            b.add("tuba", I.brass(F(m), 0.2, 0.7 + 0.05 * i, _r(), "tuba"), t + k * 0.25, -0.1)
        for k, mm in enumerate(CH[c]["pah"]):
            b.add("pah", I.brass(F(mm), 0.14, 0.5 + 0.05 * i, _r(), "horn"), t + 0.25 + 0.004 * k, 0.32 - 0.12 * k)
        for k in range(4):
            b.add("glock", I.glock(F(96 + i), 0.22 + 0.04 * i, _r(), dur=0.5), t + k * Q / 4, -0.35)
    roll(b, 26.0, 26.78, 0.45, 1.0)
    stop = np.ones(N)
    a = ns(T.BURST - 0.015)
    stop[a:a + ns(0.012)] = np.linspace(1, 0, ns(0.012))
    stop[a + ns(0.012):] = 0
    for k in b.tr:
        b.tr[k] *= stop[None, :]
    b.cues.append((24.5, "tension climb F7 - F#dim7 - Gm - G#dim7, glock ticking 16ths, snare roll crescendo"))
    b.cues.append((T.BURST, "DEAD STOP on the burst - music silent through the wave and the deadpan joke"))

    # ============ SODA WALTZ 37.59 - 48.78: warm music-box waltz (golden), one bar per soda beat, downbeat = the pop
    bar_t = [37.59 + k * 1.55 for k in range(8)]   # 8 waltz bars to the end of the explanation
    beat = 1.55 / 3
    ch3 = ["Bb", "Bb", "Eb", "F7", "Bb", "Eb", "F7", "Bb"]
    bass = [46, 46, 39, 41, 46, 39, 41, 46]
    up = [[82, 86, 89], [87, 86, 82], [87, 91, 94], [89, 93, 96], [94, 89, 86], [87, 91, 94], [89, 86, 82], [82, 86, 89]]
    for k, tb_ in enumerate(bar_t):
        if tb_ >= 48.78:
            break
        b.add("pluck", I.pluck(F(bass[k]), 0.8, _r(), dur=1.0), tb_, -0.05)
        for j in (1, 2):
            for mm in CH[ch3[k]]["hi"][1:]:
                b.add("pluck", I.pluck(F(mm), 0.4, _r(), dur=0.5, bright=0.6), tb_ + j * beat, 0.25)
        for j, m in enumerate(up[k]):
            b.add("musicbox", I.musicbox(F(m), 0.62, _r()), tb_ + j * beat, 0.2)
    b.cues.append((37.59, "soda waltz: music-box + pluck, Bb - Bb - Eb - F7 - Bb - Eb - F7 - Bb, warm golden return"))

    # ============ RULE 48.78 - 58.37: the march returns, theme B bars 1-4, stabs on the rule beats
    r0 = 48.93
    a14r = theme(r0, bars=[1, 2, 3, 4])
    melody(b, "glock", a14r, 0.42, 12, "glock", -0.35)
    melody(b, "fife", a14r, 0.5, 0, "fife", 0.25)
    for bar in (1, 2, 3, 4):
        tb = r0 + (bar - 1) * 2
        oompah(b, tb, CHB[bar], 0.62, True, 0.42)
        snare_bar(b, tb, "march", 0.56)
    b.cues.append((r0, "rule: full band theme B1-B4, the brewery is rebuilt with concrete vats"))

    # ============ CALLBACK 58.37 - 64.5: lazy swung reprise, bars 5-8, ends on the last word
    c0 = 58.37
    a58 = theme(c0, bars=[5, 6, 7], swing=True)
    melody(b, "fife", a58, 0.35, 0, "fife", 0.25)
    melody(b, "glock", a58, 0.3, 12, "glock", -0.35)
    for bar in (5, 6, 7):
        tb = c0 + (bar - 5) * 2
        oompah(b, tb, CHB[bar], 0.45, False, 0.3)
        snare_bar(b, tb, "light", 0.3)
    b.add("tuba", I.brass(F(34), 0.5, 0.7, _r(), "tuba"), 64.0, -0.1)
    b.add("glock", I.glock(F(82), 0.5, _r()), 64.0, -0.35)
    b.cues.append((c0, "callback: swung theme B5-B7, soft, final Bb button on the last word"))
    return b


TARGET = {  # relative balance inside the band (LU, measured on each track's own active span)
    "whistle": -8, "fife": -6, "glock": -7, "tuba": -6, "pah": -9, "snare": -10,
    "cymbal": -14, "stab": -8, "timpani": -9, "pad": -11, "vibes": -9, "musicbox": -7,
    "pluck": -10, "brush": -12, "triangle": -14,
}


def render(b, ref=-20.0):
    hall = make_ir(1.5, 7, pre=0.018, hf=1.4)
    yard = make_ir(0.9, 8, pre=0.008, hf=1.8, early=[(0.11, 0.5, -0.4), (0.19, 0.35, 0.5)])
    dry = np.zeros((2, N))
    wet_hall = np.zeros((2, N))
    wet_yard = np.zeros((2, N))
    levels = {}
    for k, x in b.tr.items():
        if not np.any(x):
            continue
        L = integrated(x)
        g = dbg(ref + TARGET.get(k, -6) - L)
        levels[k] = (round(L, 1), round(ref + TARGET.get(k, -6), 1))
        x = x * g
        b.tr[k] = x
        dry += x
        if k == "whistle":
            wet_yard += 0.16 * x
        else:
            wet_hall += b.send[k] * x
    out = dry + 0.7 * convolve_st(wet_hall.mean(0), hall) + 0.8 * convolve_st(wet_yard.mean(0), yard)
    out = hp(out, 30, 2)
    return out, levels
