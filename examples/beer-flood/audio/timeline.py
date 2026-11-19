# Picture timeline mirrored (read-only) from beer-short/src/videos/beer/story.ts + cast.ts so every sound lands on
# the frame: shots, the burst, the wave front, the soda pop, Crick's walk, and the camera's distance to the action.
import math
import numpy as np

FPS = 30
TOTAL = 1935
DUR = TOTAL / FPS            # 64.5 s exactly
fr = lambda f: f / FPS

BURST = 26.78                # the vat gives way ("یه ساعت بعد خمره منفجر شد")
SODA_SHAKE0, SODA_POP = 38.5, 42.5
FLASH = fr(120)              # white flash after the hook
WAVE_Z0 = -30
WAVE_SPEED = 6.5

# id: (first frame, end frame, light, crowd)
SHOTS = {
    1: (0, 120, "day", "wave"), 2: (120, 374, "day", "brewery"), 3: (374, 535, "day", "crick"),
    4: (535, 652, "day", "crick"), 5: (652, 800, "day", "brewery"), 6: (800, 997, "day", "wave"),
    7: (997, 1058, "day", "scoop"), 8: (1058, 1124, "day", "dazed"), 9: (1124, 1464, "golden", "soda"),
    10: (1464, 1752, "day", "rebuild"), 11: (1752, TOTAL, "day", "street"),
}
XFADE = {9: 8, 10: 8, 11: 8}


def shot_t(i):
    a, b = SHOTS[i][:2]
    return fr(a), fr(b)


def shot_at(t):
    f = t * FPS
    for i, (a, b, *_r) in SHOTS.items():
        if a <= f < b:
            return i
    return 11


def _lin(pts, x):
    return float(np.interp(x, [p[0] for p in pts], [p[1] for p in pts]))


# the wave front position (m along the street) and height (m) after the burst
def wave_z(tau):
    return WAVE_Z0 + WAVE_SPEED * max(0.0, tau - BURST)


def wave_h(tau):
    if tau < BURST:
        return 0.0
    return _lin([(BURST, 4.5), (BURST + 2, 4.2), (BURST + 5, 2.4), (BURST + 9, 1.2), (BURST + 12, 0.9)], tau)


# vat pressure 0 -> 1 as the story approaches the burst (creaks + groans grow with it)
def pressure(tau):
    return _lin([(12.6, 0), (17.9, 0.25), (21.9, 0.55), (26.6, 1.0), (BURST, 1.0)], tau)


def hh(i, s=0):
    """same hash as cast.ts (IEEE doubles, so it reproduces the JS values)"""
    v = math.sin(i * 127.1 + s * 311.7) * 43758.5453
    return v - math.floor(v)


def words(path):
    import json
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def easeout(u):
    u = min(1.0, max(0.0, u))
    return 1 - (1 - u) ** 4


# Crick's walk-away (shot 4, 19.2-21.7 s): footfalls every ~0.5 s
CRICK_STEPS = [19.35 + k * 0.5 for k in range(5)]
# the three fleeing townspeople (shot 6): footfalls from the burst, ~0.45 s apart, staggered
FLEE_STEPS = [BURST + 0.35 + k * 0.45 for k in range(12)]
# the strolling townspeople (shot 11): footfalls every ~0.6 s
STROLL_STEPS = [58.6 + k * 0.6 for k in range(9)]
