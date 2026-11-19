---
name: muse-animated-shorts
description: Make a 55-70 s vertical cartoon story short in the "2D characters in a painted 3D world" style (flat bean-head cartoon cards with ink outlines, painted 3D town with black ink lines, saturated sky, depth-of-field backgrounds, gliding cameras, one steady narrator, synthesized SFX and march-style music), rendered locally with three.js inside Remotion. No video-generation API, no paid service, no subscription. Proven on "The London Beer Flood" (64.5 s, Persian narration). Use when the user asks for a cartoon story short, a viral animated short, a video "like the beer flood one", a history/science story as a vertical video, or says "use the animated shorts skill".
---

# Animated shorts for Muse (three.js + Remotion, 100% local)

Make a ~55-70 second vertical cartoon story short. Flat 2D bean-head characters
with ink outlines live in a colourful painted 3D world. Everything renders on
the user's own machine: three.js inside Remotion, a local text-to-speech voice,
word timings from a local speech-to-text model, and music plus sound effects
synthesized in code. Nothing is sent to a video-generation API and nothing
costs money.

Proven example: **"The London Beer Flood"** — 64.5 s, 720x1280, 30 fps,
Persian narration, in `examples/beer-flood/` (full Remotion project, script,
voice, sound scripts, and the finished video).

Inspiration: the approach was adapted from
[mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts)
(MIT). The style values, script formula and pipeline shape come from studying
that project; the story, characters, shots, music and voice here are entirely
our own. Never copy another creator's scripts, characters or shots, and never
name a reference channel in a voice-over or description.

## Rules that always apply

- **Story, characters and voice are always original.** Pick a true story, write
  your own script, draw your own characters.
- **No captions, no on-screen text, no title card.** The picture and the voice
  carry everything.
- **One steady narrator**, one tone, all the way through.
- **Every joke is a researched real fact.** Verify every number and name
  against a source and write the sources at the top of `SCRIPT.md`.
- **No video-generation API, no cloud render, no subscription.** If a step
  needs an account or a key, find a local replacement.
- **Save after every step.** Voice, script, shot plan, sound and render are
  separate artefacts; a later step never silently redoes an earlier one.

## Toolchain (all local, all free)

| Tool | What it does | Notes |
|---|---|---|
| Node 20+ / 22 / 24 | Runs Remotion | `npm install` in the project |
| Remotion 4 + `@remotion/three` | Renders the video | Local headless render, no cloud |
| three.js + React Three Fiber | The painted 3D world | Characters are 2D cards inside it |
| Python 3 + ffmpeg | Sound synthesis, mixing, muxing | ffmpeg 7+ recommended |
| Piper TTS (offline) | The narrator's voice | Any local TTS works; pick a voice per language |
| faster-whisper (local) | Word timings (`words.json`) | CPU, int8, base model is enough |

Install once: `npm install` in the Remotion project, `pip install piper-tts
faster-whisper numpy scipy` (or your distro's equivalents) for the sound side.

## Pipeline

### 1. Topic and facts
Pick one surprising **true** story with a physical cause and effect that can be
*seen* — a flood, a collapse, a machine failing, an animal doing something
absurd — plus one everyday analogy that explains the mechanism (a shaken soda
bottle, a kid on a swing). Write the facts with their sources at the top of
`SCRIPT.md` before writing a single line of dialogue.

### 2. Script (~55-70 s, one steady narrator)
Measure your voice first: a fast English narrator runs ~3.7 words/s; our
Persian Piper voice runs ~2.5 words/s. Count words against the voice you
actually have, and trim the script to fit — never stretch the voice to fit
the script. Beat formula (8 beats, proven):

1. **Hook** (1 line, 0-4 s): the most unbelievable true sentence of the story.
2. **Setting** (4-12 s): year, place, and what the place was proud of.
3. **Escalation** (12-27 s): three or four beats, each a little bigger; the
   last one is the point of no return.
4. **Snap** (1 line, 27-33 s): the thing breaks / happens. The music stops
   dead here — the joke lands in the silence.
5. **Deadpan double line** (33-37 s): the same fact twice with opposite spin
   ("Luckily... / Unluckily...").
6. **Explanation** (37-49 s): the mechanism, through the everyday analogy.
   Golden light for this section.
7. **Consequence** (49-58 s): the rule, law or change the event created.
8. **Callback twist** (58-64 s): the last line reframes the first fact.

Never describe on screen what the viewer already sees. Voice starts at frame
1-4 — no intro, no title card.

### 3. Voice
Generate `voice.wav` (one line per file is easiest, then concatenate), then
make `words.json` — one entry per word with start/end times in seconds — with
any speech-to-text model that gives word times. faster-whisper works offline.

- Use the **timings**, not the spellings: STT orthography is loose
  (especially in Persian: Arabic letter forms, split words). Per-line
  boundaries are exact if you synthesize line by line and leave a 0.15 s gap.
- Hand-fix the timings. **Everything is timed to words.json** — expressions,
  camera moves, sound effects.
- Keep the voice untouched in the mix: gain only, no EQ, no compression,
  no pitch shift.

### 4. Shot plan (`story.ts`)
One file holds the whole visual plan. The shape:

- `SHOTS`: `{ id, a, b, light: "day" | "golden", crowd, tau }` — frame
  ranges, light preset, crowd key, story time.
- `XFADE`: crossfade frames at place/time changes. `FLASH_AT`: a 4-frame
  white flash right after the hook.
- `CAMS[id]`: camera keys `{ f, dur?, cut?, s: (f) => Shot }` — position,
  look point, field of view, roll.
- `KICKS`: `[time_s, gain]` — 7-frame impact shakes, alternating sign
  every frame, decaying to zero.
- `DOF` / `dofAt()`: thin-lens focus distance and depth, interpolated
  across beats.
- `layersAt(f)`: base shot plus the next shot fading in during a crossfade.
- Story physics as **pure functions of story time** (seconds): wave height,
  pressure, whether a prop is intact. A `world.update(id, f, cam, scene)`
  function poses everything from `(shot, frame)` alone — no hidden state.
- Cast staging per shot: where each character stands, walks, looks.

Camera grammar: smootherstep glides of 18-40 frames, push-ins of 0.15-0.35%
per frame (0.6%/f on punch words), hard cuts on big jumps, 7-frame impact
kicks, rolls of 4-5 degrees, no hand-held float. Keep cameras inside the
street corridor (|x| < 6 m) or above the roofs (y > 12 m) — house rows block
any camera placed behind them. Keep characters clear of large props (a vat's
radius is 2.3 m; characters standing inside a prop read as a bug).

### 5. World (painted 3D)
- **Light presets**: day (sun azimuth 75, elevation 48; lit tones
  [1.58, 1.5, 1.33], shade [.30, .29, .36]; sky top #3e7fd2 to horizon
  #b8d0ec; fog = horizon colour, 25-300 m) and golden (azimuth 6, elevation
  7; key toward #FFB36B at 1.5x; sky #ffc47c to #8a6f8a).
- **Shading**: two-tone sun term (lit cap + cool belly), saturation 1.08.
- **Textures**: painted on HD Canvas2D with seams drawn in as dark tints;
  cull anything that blocks a camera's sight-line.
- **Sky**: shader sky, fog matched to the horizon colour, depth-of-field
  backgrounds, saturated sky.
- **Post order**: ink outlines -> lens pre -> lens main -> bloom (threshold
  1.0, intensity 0.5, 6 levels, radius 0.6) -> NEUTRAL tone map -> colour
  grade. Film grain OFF. Ink #030303, 5.1 px near (6 m) to 3.3 px far
  (90 m) at 1080x1920; every pixel parameter scales with output height.

### 6. Characters (2D cards in the 3D world)
- **Bean heads** (head width/height 0.94), plum ink #241726, eyes 0.26 head
  widths apart, no blush. Adults are 3.5 head-heights tall. Walk bob 5%,
  lean 1-7 degrees.
- **Expressions**: a face library of ~14 states (neutral, grin, laugh,
  smile_closed, stern, nervous, shock, dazed, ...). Expression swaps land
  **0-3 frames before** the word that triggers them, with a blink across
  the swap to hide it. Blinks come 0.5-2.3 s apart (4-frame blink:
  half/shut/shut/half).
- **Cards**: camera-facing billboards on a NOINK layer (no ink-outline pass),
  lit by the scene light, never emissive. One canvas per distinct drawing,
  keyed by outfit + options + light; pick front/side view and mirroring
  from the walk direction versus the camera.
- **A wall reads as a wall**: a huge flat surface (a flood wave, a cliff)
  filmed head-on looks like a blank wall. Shoot it at an angle, break it
  with foam/a crest/a character in front, or keep the camera moving across
  it — never hold a flat head-on shot of it.

### 7. Sound (all synthesized, no samples)
- **Music**: an original march in the story's idiom (our example: an 8-bar
  Bb march with rising fourths). Write it in code (note tables + simple
  instrument synthesis), never reuse library music.
- **SFX**: a cue list of events (a hoop slipping, a crack, a burst, a
  crowd gasp) plus ambient beds, all synthesized in numpy/scipy. Distance
  effects for far sounds.
- **Timeline**: a Python mirror of `story.ts` (shots, physics, footfall
  times) so sound and picture share one clock. **Lock the picture's time
  constants before making the sound** — any later timing change means
  re-running the sound.
- **Mix rules**: music +3 dB, SFX -6 dB (both relative to the voice),
  voice unchanged. Duck the music -3 dB under speech, keyed from
  `words.json`. Master to **-14 LUFS integrated, true peak <= -1 dBTP**
  (limit, don't crush: our master needed 1.5 dB of gain reduction at most).
  Output `mix.wav` (48 kHz, exact video length) plus stems and a cue sheet.

### 8. Look checks
Never trust a render you haven't looked at. Extract stills at several
points (start, each beat, end) at half scale and inspect them:

- Characters fully in frame, not cut at the edges, not standing inside props.
- Cameras not inside walls or house rows.
- The wave/flood reads as a wave, not a wall.
- Expressions match the words at that moment.
- No blank, black or frozen frames.

Fix what you find in `story.ts` / `world.ts` / `cast.ts` and re-check.
A 15-second low-resolution preview render is the fastest way to judge
motion; a full render is for the end.

### 9. Final render and QA
- Render: `npx remotion render BeerShort --image-format=jpeg
  --jpeg-quality=85 --scale=1.0` (720x1280). For 2K output add
  `--scale 1.3333` (1440x2560). Expect ~3 s/frame on a CPU-only machine
  (~100 min for 64 s) and much faster on a GPU.
- The render is silent; mux the mix afterwards:
  `ffmpeg -i silent.mp4 -i audio/mix.wav -c:v copy -c:a aac -shortest final.mp4`
- QA the final file: duration and resolution, every frame scanned for
  black/white/frozen frames, loudness re-checked (-14 LUFS, TP <= -1 dBTP),
  and a visual pass over the opening, middle and end.

### 10. Deliver
Send the finished mp4 with a one-line description of the story. Note any
accepted deviation plainly (a line that didn't land, a shot that stayed
imperfect) instead of hiding it.

## Known issues and their fixes

These were found while building the example. If you hit them, the fix is
already known — don't rediscover it.

1. **Frames 0-1 are blank** (flat background, no scene). The composer's
   first advance happens before it exists. Fix in post: duplicate frame 2
   over frames 0-1. (Our example's final video already has this fix.)
2. **`remotion still` renders blank** when the EffectComposer is in the
   composition. Don't remove the composer — verify with short `remotion
   render` ranges instead (video frames render correctly).
3. **Multisampling**: the reference uses MSAA 4. On software rendering
   (SwiftShader / headless CPU) set `multisampling={0}` or the render fails.
4. **Slow local TTS**: some voices run ~2.5 words/s instead of ~3.7.
   Measure your voice and **trim the script** to fit 55-70 s; don't speed
   up the audio.
5. **STT spellings are unreliable** in some languages. Trust the timings,
   ignore the spellings, and fix word boundaries by hand.
6. **A flat surface filmed head-on reads as a wall.** Angle the camera,
   add foam/crest detail, or put a character in front of it.
7. **Characters drift out of frame** at the edges of wide shots. Check the
   outer characters in every shot, not just the centre one.
8. **Voice dips under the loudest music moment.** Check the voice against
   the bed in the loudest section (the snap/tension beat); if a short
   window sits under the bed, duck the music harder there.

## Project layout

```
skill/muse-animated-shorts/SKILL.md   <- this file (copy to ~/.claude/skills/)
examples/beer-flood/                   <- worked example, ready to render
  remotion/                            <- Remotion project (BeerShort comp)
    src/videos/beer/                   <- story.ts, world.ts, cast.ts, ...
    package.json                       <- npm install, then render
  audio/                               <- timeline.py, music.py, sfx.py, mix.py
  voice/                               <- voice.wav, words.json, per-line wavs
  SCRIPT.md                            <- facts + 10-beat Persian script
  beer-short-final.mp4                 <- the finished 64.5 s short
  poster.jpg                           <- poster frame
```

To make your own short, copy `examples/beer-flood/remotion/` to a new
folder, write a new `SCRIPT.md`, record a new voice, and rewrite `story.ts`,
`world.ts` and the cast staging. The drawing primitives (`toon.ts`,
`paint.ts`, `lights.ts`, `shade.ts`, `ink.ts`, `lensblur.ts`, `grade.ts`,
`build.ts`) are reusable; the story is always new.
