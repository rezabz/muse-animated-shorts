# Every sound effect + ambience bed of the beer-flood short as a cue list timed to the picture (timeline.py),
# rendered into one stereo SFX stem. Levels follow the user's standard mix: each EVENT has a "naive" level
# (LU relative to the voice stem, measured as the event's max momentary loudness) and is placed SFX_DB = -6 dB
# under it; ambience BEDS (integrated loudness) are not reduced.
import math
import numpy as np
from dsp import (SR, ns, tt, rng, dbg, lp, hp, bp, peq, shelf, pan, st, place, fades, widen, make_ir, convolve_st,
                 momentary_max, integrated, colored, smooth_noise, modal)
import sfx_gen as G
import timeline as T

N = ns(T.DUR)
SFX_DB = -6.0


class Cue:
    def __init__(self, t, name, desc, gen, naive, kind="event", p=0.0, extra=0.0, lpf=None, send=0.12, group=None, cut=None):
        self.t, self.name, self.desc, self.gen, self.naive = t, name, desc, gen, naive
        self.kind, self.p, self.extra, self.lpf, self.send, self.cut = kind, p, extra, lpf, send, cut
        self.group = group or name
        self.applied = naive + (SFX_DB if kind == "event" else 0.0) + extra
        self.measured = None


def _add(*xs):
    """add mono/stereo signals of different lengths: pad to the longest, stereo out"""
    xs = [np.asarray(x) for x in xs]
    n = max(x.shape[-1] for x in xs)
    out = np.zeros((2, n))
    for x in xs:
        if x.ndim == 1:
            x = st(x)
        out[:, :x.shape[1]] += x
    return out


def cues():
    C = []
    R = rng(1831)
    rr = lambda: rng(int(R.integers(1 << 30)))
    add = C.append

    # ------------------------------------------------ ambience beds (not reduced by the -6 dB event rule)
    def amb_street(dur, seed=1):
        def g():
            r = rng(seed)
            n = ns(dur)
            x = G.breeze(dur, r, 1.0, 0.15, 850)
            x += st(bp(colored(n, r, 0.8), 180, 1800, 1) * 0.3 * (0.8 + 0.2 * smooth_noise(n, r, 0.3)))
            x += pan(G.bird_chirps(dur, r, 0.45, "sparrow") * 0.08, 0.5)
            x += pan(G.bird_chirps(dur, r, 0.3, "sparrow") * 0.05, -0.6)
            return fades(x, 0.4, 0.6), 0.0
        return g
    add(Cue(0.0, "amb_street", "1814 London street: breeze, sparrows, distant town (shots 1-5)", _cut(amb_street(26.78, 1), 26.78, 0.4, 0.5),
            -30, "bed", send=0.0))
    add(Cue(T.BURST, "amb_water", "beer flood around the street: flow, sloshes, bubbles (shots 6-8)",
            _env(lambda: (G.water_bed(10.8, rng(41), 1.0, 0.9), 0.0), 10.8, 0.35, 0.3), -19, "bed", send=0.0))
    add(Cue(37.59, "amb_golden", "golden-hour calm: soft breeze, blackbird phrases, faint crickets (shot 9)",
            _env(lambda: (_golden(11.19, rng(43)), 0.0), 11.19, 0.5, 0.4), -29, "bed", send=0.0))
    add(Cue(48.93, "amb_street2", "rebuilt street: breeze, sparrows (shots 10-11)", _cut(amb_street(15.57, 44), 15.57, 0.25, 0.35),
            -29, "bed", send=0.0))

    # ------------------------------------------------ hook extras (shot 1 is the flash-forward of the wave)
    add(Cue(0.0, "wave_rush_hook", "the wave already rushing down the street in the flash-forward (hook)",
            lambda: (G.water_bed(4.0, rng(11), 0.9, 1.1), 0.0), -16, p=-0.2, send=0.2))
    add(Cue(T.FLASH, "flash_whoosh", "reverse swell into the white flash (frame 120) + soft low whoomp",
            lambda: _flash(rng(120)), -5, send=0.2))

    # ------------------------------------------------ the vat strains (shots 3-5)
    add(Cue(13.5, "hoop_slip", "the 700-pound iron hoop slips: metal groan + wood creak (Crick looks up)",
            lambda: (_add(G.creak(0.7, rng(135), 90, 160, G.WOOD, rough=0.15), G.clink(rng(136), 1800, 0.1) * 0.5), 0.0),
            -8, p=-0.3, send=0.12))
    add(Cue(16.0, "hoop_creak2", "second hoop slip, lower and longer",
            lambda: (G.creak(0.9, rng(160), 70, 130, G.WOOD, rough=0.18), 0.0), -9, p=-0.3, send=0.12))
    for tm in T.CRICK_STEPS:
        add(Cue(tm, "crick_step", "Crick walks away from the vat: cobbled footsteps",
                (lambda r=rr(): (G.stroll_step(r, 0.7), 0.0)), -12, p=0.1, send=0.08, group="steps"))
    add(Cue(21.9, "vat_groan", "the vat groans as the pressure builds: long wood strain",
            lambda: (G.creak(1.6, rng(219), 60, 110, G.WOOD, rough=0.2), 0.0), -7, p=-0.3, send=0.15))
    add(Cue(24.5, "vat_groan2", "the vat groans louder, hoops rattling",
            lambda: (_add(G.creak(1.8, rng(245), 55, 120, G.WOOD, rough=0.22), G.rattle(1.2, rng(246), 22.0) * 0.4), 0.0),
            -6, p=-0.3, send=0.15))

    # ------------------------------------------------ THE BURST (26.78) + the wave (shots 6-8)
    add(Cue(T.BURST, "vat_burst", "THE VAT BURSTS: timber tear + hoop snap + beer explosion",
            lambda: (_add(G.timber_tear(rng(2678), 0.9), G.bolt_snap(rng(2679)) * 0.8, G.splash_big(rng(2680)) * 1.2), 0.0),
            0, p=-0.2, send=0.18))
    add(Cue(T.BURST + 0.15, "wave_whoosh", "the wave slams through the brewery wall: huge whoosh + crash",
            lambda: (G.whoosh(1.4, rng(2681), 0.5, 250, 1800, 0.9, 0.3, 0.3), 0.15), -3, p=0.0, send=0.2))
    add(Cue(T.BURST + 0.4, "wall_crash", "the back wall collapses: timber + brick debris",
            lambda: (_debris(rng(2682)), 0.0), -6, p=0.2, send=0.15))
    for tm in T.FLEE_STEPS:
        add(Cue(tm, "flee_step", "townspeople fleeing the wave: running footsteps on cobbles",
                (lambda r=rr(): (G.boot(r, 1.0), 0.0)), -11, p=0.15, send=0.1, group="flee"))
    add(Cue(T.BURST + 0.5, "crowd_oofs", "people knocked about by the wave: oofs and whoas",
            lambda: (_oofs(rng(2683)), 0.0), -8, send=0.15))
    add(Cue(28.4, "wave_slam", "the wave slams the houses: second big splash",
            lambda: (G.splash_big(rng(2840)), 0.0), -5, p=-0.1, send=0.18))
    add(Cue(30.1, "wave_slam2", "the wave reaches the far end of the street",
            lambda: (G.splash_big(rng(3010)), 0.0), -7, p=0.1, send=0.15))

    # ------------------------------------------------ the deadpan joke (shots 7-8)
    add(Cue(33.4, "scoop_laugh", "free beer! townspeople laughing, scooping with jugs",
            lambda: (_cheer(2.2, rng(334)), 0.0), -6, lpf=5000, send=0.3))
    add(Cue(35.5, "dazed_murmur", "...free beer. the laughter dies into a dazed murmur",
            lambda: (_murmur(2.0, rng(355), 8), 0.0), -12, lpf=3600, send=0.3))

    # ------------------------------------------------ the soda analogy (shot 9, golden)
    add(Cue(T.SODA_SHAKE0, "soda_shake", "the kid shakes the soda bottle: fizz + rattle, faster and faster",
            lambda: (_add(G.rattle(4.0, rng(385), 26.0) * np.interp(tt(4.0), [0, 3.0, 4.0], [0.4, 0.8, 1.0]),
                     G.bubbles(4.0, rng(386), 90, 400, 2400, (0.005, 0.02)) * 0.5), 0.0),
            -9, p=0.2, send=0.1))
    add(Cue(T.SODA_POP, "soda_pop", "THE CAP POPS: clink + foam burst + fizz",
            lambda: (_add(G.clink(rng(425), 3200, 0.12) * 1.2, G.bubbles(0.8, rng(426), 160, 500, 3000, (0.004, 0.015)) * 0.8,
                     G.splash_big(rng(427)) * 0.3), 0.0), -4, p=0.2, send=0.15))

    # ------------------------------------------------ the rule + callback (shots 10-11)
    add(Cue(49.5, "concrete_roll", "a concrete vat rolls in: low rumble + wood groan",
            lambda: (_add(G.rattle(1.5, rng(495), 14.0, heavy=True) * 0.5, G.creak(1.0, rng(496), 50, 90, G.WOOD, rough=0.2) * 0.6), 0.0),
            -9, p=-0.2, send=0.12))
    for tm in T.STROLL_STEPS:
        add(Cue(tm, "stroll_step", "townspeople strolling the rebuilt street",
                (lambda r=rr(): (G.stroll_step(r, 0.5), 0.0)), -13, p=0.1, send=0.08, group="stroll"))

    # ------------------------------------------------ camera-move whooshes
    for f, desc in [(120, "flash cut to the brewery"), (374, "push to Crick"), (535, "cut to the note"),
                    (652, "push to the vat"), (800, "cut to the burst"), (997, "cut to the scoopers"),
                    (1124, "crossfade to golden"), (1464, "crossfade to the rebuild"), (1752, "crane out")]:
        add(Cue(T.fr(f), "whoosh_cam", f"camera {desc}", (lambda r=rr(): (G.whoosh(0.6, r, 0.09, 330, 2000, 0.8, 0.18, 0.15), 0.09)),
                -11, send=0.12))
    return C


def _cut(gen, dur, fin, fout):
    def g():
        x, a = gen()
        return fades(x, fin, fout), a
    return g


def _env(gen, dur, fin, fout):
    return _cut(gen, dur, fin, fout)


def _golden(dur, r):
    n = ns(dur)
    x = G.breeze(dur, r, 0.7, 0.1, 650)
    x += st(lp(bp(colored(n, r, 0.8), 150, 1400, 1), 1200) * 0.35)
    x += pan(G.bird_chirps(dur, r, 0.35, "blackbird") * 0.06, -0.5)
    x += pan(G.bird_chirps(dur, r, 0.25, "blackbird") * 0.04, 0.6)
    x += widen(G.crickets(dur, r, 3) * 0.008, r, 9, 1.0)
    return x


def _flash(r):
    dur = 0.75
    y = G.whoosh(dur, r, 0.33, 500, 4200, 0.9, 0.09, 0.4)
    t = tt(dur)
    boom = np.where(t > 0.33, np.exp(-(t - 0.33) / 0.12) * np.sin(2 * np.pi * 62 * (t - 0.33)), 0) * 0.8
    return widen(y + boom, r, 12, 0.9), 0.33


def _murmur(dur, r, voices, early=False):
    n = ns(dur)
    out = np.zeros((2, n))
    for v in range(voices):
        kind = r.uniform()
        base, scale = ((r.uniform(95, 140), r.uniform(0.95, 1.05)) if kind < 0.45 else
                       (r.uniform(175, 235), r.uniform(1.12, 1.2)) if kind < 0.85 else (r.uniform(260, 330), r.uniform(1.25, 1.35)))
        y = G.babble(dur, r, base, scale, r.uniform(3.6, 4.8), r.uniform(0.55, 0.8), fmax=3400)
        y = lp(y, r.uniform(2200, 3600), 1) * r.uniform(0.3, 1.0)
        out += pan(y, r.uniform(-0.85, 0.85))
    if early:
        for k in range(4):
            h = G.hurrah(r, r.uniform(110, 230), r.uniform(1.0, 1.18))
            place(out, pan(lp(h, 3000, 1) * 0.5, r.uniform(-0.8, 0.8)), r.uniform(0.2, 1.6))
    return fades(out, 0.25, 0.8)


def _cheer(dur, r):
    n = ns(dur)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for v in range(26):
        kid = v % 6 == 5
        base = r.uniform(270, 340) if kid else (r.uniform(105, 160) if v % 2 else r.uniform(180, 250))
        scale = 1.3 if kid else (1.0 if v % 2 else 1.15)
        for rep in range(1 + int(r.uniform() < 0.4)):
            h = G.hurrah(r, base * r.uniform(0.97, 1.05), scale, kid)
            tm = r.uniform(0.25, 1.1) + rep * r.uniform(0.75, 1.0)
            place(out, pan(lp(h, 4000, 1) * r.uniform(0.35, 1.0), r.uniform(-0.9, 0.9)), tm)
    env = np.interp(t, [0, 0.4, 1.0, 1.9, 3.4], [0.0, 0.5, 1.0, 0.75, 0.0])
    out += G.applause(dur, r, 40, env) * 0.9
    return fades(out, 0.05, 0.5)


def _oofs(r):
    out = np.zeros((2, ns(0.9)))
    kinds = ["oof", "oof", "ugh", "oh", "oof", "ow", "ugh", "oof", "oh", "oof", "ugh", "ow"]
    for v, k in enumerate(kinds):
        o = G.oof(r, k)
        tm = abs(r.normal(0.06, 0.08)) + (0.0 if v < 5 else 0.1)
        place(out, pan(o * r.uniform(0.45, 1.0), r.uniform(-0.85, 0.85)), min(tm, 0.45))
    return out


def _debris(r):
    out = np.zeros((2, ns(1.2)))
    for k in range(7):
        knock = modal(0.3, [(r.uniform(180, 320), 1.0, 0.04), (r.uniform(450, 900), 0.6, 0.02), (r.uniform(1200, 2400), 0.3, 0.01)], r)
        sp = G.bubbles(0.3, r, 120, 400, 2200, (0.005, 0.02), np.exp(-tt(0.3) / 0.08)) * 0.5
        place(out, pan((knock + sp) * r.uniform(0.3, 1.0), r.uniform(-0.8, 0.8)), r.uniform(0, 0.8))
    return out


# ================================================================ render
def render(v_ref, on_event=None):
    """v_ref = integrated loudness of the voice stem (stereo). Returns (stereo stem, cue list with measured levels).
    on_event(cue, x, t0) is called with every placed (dry) event, for analysis."""
    C = cues()
    out = np.zeros((2, N))
    send = np.zeros(N)
    for c in C:
        x, anchor = c.gen()
        x = np.asarray(x, float)
        x = pan(x, c.p) if x.ndim == 1 else x
        if c.cut is not None:
            k = ns(c.cut - (c.t - anchor))
            if 0 < k < x.shape[1]:
                x = fades(x[:, :k], 0.0, 0.02)
        tgt = v_ref + c.applied
        cur = momentary_max(x) if c.kind == "event" else integrated(x)
        if np.isfinite(cur):
            x = x * dbg(tgt - cur)
        if c.lpf:
            x = lp(x, c.lpf, 1)
        c.measured = momentary_max(x) - v_ref if c.kind == "event" else integrated(x) - v_ref
        t0 = c.t - anchor
        place(out, x, t0)
        if on_event:
            on_event(c, x, t0)
        if c.send > 0:
            G._place_mono(send, c.send * x.mean(0), t0)
    valley = make_ir(1.1, 77, pre=0.01, hf=1.6, early=[(0.09, 0.45, -0.5), (0.14, 0.3, 0.6), (0.23, 0.2, -0.2)])
    out += 0.55 * convolve_st(send, valley)
    out = hp(out, 25, 2)
    end = ns(T.DUR - 0.12)
    out[:, end:] *= np.linspace(1, 0, N - end)[None, :] ** 2
    return out, C
