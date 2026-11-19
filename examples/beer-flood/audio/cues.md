# The London Beer Flood - soundtrack cue sheet

All sound is original: synthesized in numpy/scipy by `sfx_gen.py` / `instruments.py`, placed by `sfx.py` / `music.py`, mixed by `mix.py`.
Voice = `voice/voice.wav` (Persian Piper TTS, fa_IR-amir-medium), gain only (no EQ, no compression, no pitch).

## Files
| file | content |
|---|---|
| `mix.wav` | final mix, 48 kHz, stereo, 24-bit, 3,096,000 samples = 64.500 s |
| `stem_voice.wav` / `stem_music.wav` / `stem_sfx.wav` | stems at mix gain (they sum to the mix before the master limiter) |

## Master loudness (own BS.1770-4 meter)
- Integrated **-14.0 LUFS**, true peak **-1.2 dBTP**, LRA 2.5 LU, max momentary -10.2 LUFS, max short-term -12.5 LUFS
- Stems: voice -14.1 LUFS, music -25.0 LUFS, sfx -29.2 LUFS (voice gain -1.23 dB, same gain on every stem)
- Master limiter (4x oversampled look-ahead, ceiling -1.2 dBTP): max gain reduction 1.49 dB, active (>0.1 dB) on 3.54 % of samples, >0.5 dB on 0.37 %

ffmpeg ebur128 cross-check:
```
Summary:
  Integrated loudness:
    I:         -14.0 LUFS
    Threshold: -24.2 LUFS
  Loudness range:
    LRA:         2.5 LU
    Threshold: -34.3 LUFS
    LRA low:   -15.6 LUFS
    LRA high:  -13.0 LUFS
  True peak:
    Peak:       -1.2 dBFS
```

## Voice on top: per-section loudness (LUFS, integrated per stem, at mix gain)
bed = music + sfx. margin = voice - bed (integrated over the section). speech median / p10 = median and 10th percentile of the 400 ms momentary margin (voice - bed) over windows centred on spoken words.

| section (shots) | time s | voice | music | sfx | bed | margin LU | speech median LU | speech p10 LU |
|---|---|---|---|---|---|---|---|---|
| hook (1) | 0.00-4.00 | -13.3 | -23.0 | -35.3 | -22.7 | 9.4 | 9.7 | 6.5 |
| setting (2) | 4.00-12.47 | -13.9 | -24.4 | -41.0 | -24.3 | 10.4 | 11.0 | 6.4 |
| crick (3-4) | 12.47-21.73 | -14.5 | -27.5 | -33.5 | -26.6 | 12.1 | 12.4 | 5.9 |
| tension (5) | 21.73-26.67 | -15.6 | -23.2 | -29.1 | -22.4 | 6.8 | 6.4 | -0.1 |
| burst+wave (6) | 26.67-33.23 | -13.7 | -35.7 | -25.6 | -25.6 | 11.8 | 13.8 | 5.8 |
| deadpan (7-8) | 33.23-37.47 | -14.4 | - | -28.9 | -28.9 | 14.5 | 14.9 | 11.8 |
| soda (9) | 37.47-48.80 | -13.2 | -25.1 | -32.2 | -24.5 | 11.3 | 11.9 | 6.8 |
| rule (10) | 48.80-58.40 | -14.8 | -26.3 | -37.2 | -26.0 | 11.2 | 11.7 | 7.7 |
| callback (11) | 58.40-64.50 | -13.5 | -24.5 | -34.3 | -24.1 | 10.6 | 11.9 | 5.0 |

## Music map (original march, Bb major, 120 bpm: quarter note = footfall)
Music target per section, LU under the voice (after a -3 dB speech duck keyed from words.json): hook -9.5, setting -10.5, tension -10.0, soda -12.0, rule -11.5, callback -11.0. Applied section gains (dB): hook +0.7, setting +0.6, tension +1.7, soda +3.7, rule -2.3, callback +8.1, dropout +1.7.

Rides (music only, dB): 3.65-4.00 s -3.0, 26.00-26.78 s -6.0, 48.60-49.20 s -3.0 - so quiet sentence-final words stay on top and the band blooms in the gaps after them.

| time s | frame | music |
|---|---|---|
| 0.00 | 0 | hook: theme B1-B2 tutti (glock + fife, tuba/after-beats/snare); snare fill 3.0-3.9 |
| 4.00 | 120 | Bb button + light clash exactly on the white flash (frame 120), then the band is gone |
| 4.50 | 135 | setting: theme B1-B4 light (glock + fife), full band from bar 3 as the vat fills the frame |
| 12.50 | 375 | tension: theme B5-B6 fragment, thin (fife + tuba on 1/3), the hoop has slipped |
| 24.50 | 735 | tension climb F7 - F#dim7 - Gm - G#dim7, glock ticking 16ths, snare roll crescendo |
| 26.78 | 803 | DEAD STOP on the burst - music silent through the wave and the deadpan joke |
| 37.59 | 1128 | soda waltz: music-box + pluck, Bb - Bb - Eb - F7 - Bb - Eb - F7 - Bb, warm golden return |
| 48.93 | 1468 | rule: full band theme B1-B4, the brewery is rebuilt with concrete vats |
| 58.37 | 1751 | callback: swung theme B5-B7, soft, final Bb button on the last word |

## SFX events
Level convention: every EVENT has a naive level (LU vs the voice stem, as the event's max momentary loudness); applied = naive - 6 dB (standard mix rule) + distance/intensity offsets. BEDS are integrated loudness, not reduced. 'mix LUFS' = the event's max momentary loudness in the final mix (voice stem = -14.1 LUFS integrated).

| # | time s | frame | cue | what | naive LU | applied LU | mix LUFS | pan |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.000 | 0.0 | amb_street (bed, integrated) | 1814 London street: breeze, sparrows, distant town (shots 1-5) | -30 | -30.0 | -44.1 | +0.00 |
| 2 | 0.000 | 0.0 | wave_rush_hook | the wave already rushing down the street in the flash-forward (hook) | -16 | -22.0 | -36.1 | -0.20 |
| 3 | 4.000 | 120.0 | flash_whoosh | reverse swell into the white flash (frame 120) + soft low whoomp | -5 | -11.0 | -25.1 | +0.00 |
| 4 | 4.000 | 120.0 | whoosh_cam | camera flash cut to the brewery | -11 | -17.0 | -31.1 | +0.00 |
| 5 | 12.467 | 374.0 | whoosh_cam | camera push to Crick | -11 | -17.0 | -31.1 | +0.00 |
| 6 | 13.500 | 405.0 | hoop_slip | the 700-pound iron hoop slips: metal groan + wood creak (Crick looks up) | -8 | -14.0 | -28.1 | -0.30 |
| 7 | 16.000 | 480.0 | hoop_creak2 | second hoop slip, lower and longer | -9 | -15.0 | -29.1 | -0.30 |
| 8 | 17.833 | 535.0 | whoosh_cam | camera cut to the note | -11 | -17.0 | -31.1 | +0.00 |
| 9 | 19.350 | 580.5 | crick_step | Crick walks away from the vat: cobbled footsteps | -12 | -18.0 | -32.1 | +0.10 |
| 10 | 19.850 | 595.5 | crick_step | Crick walks away from the vat: cobbled footsteps | -12 | -18.0 | -32.1 | +0.10 |
| 11 | 20.350 | 610.5 | crick_step | Crick walks away from the vat: cobbled footsteps | -12 | -18.0 | -32.1 | +0.10 |
| 12 | 20.850 | 625.5 | crick_step | Crick walks away from the vat: cobbled footsteps | -12 | -18.0 | -32.1 | +0.10 |
| 13 | 21.350 | 640.5 | crick_step | Crick walks away from the vat: cobbled footsteps | -12 | -18.0 | -32.1 | +0.10 |
| 14 | 21.733 | 652.0 | whoosh_cam | camera push to the vat | -11 | -17.0 | -31.1 | +0.00 |
| 15 | 21.900 | 657.0 | vat_groan | the vat groans as the pressure builds: long wood strain | -7 | -13.0 | -27.1 | -0.30 |
| 16 | 24.500 | 735.0 | vat_groan2 | the vat groans louder, hoops rattling | -6 | -12.0 | -26.1 | -0.30 |
| 17 | 26.667 | 800.0 | whoosh_cam | camera cut to the burst | -11 | -17.0 | -31.1 | +0.00 |
| 18 | 26.780 | 803.4 | amb_water (bed, integrated) | beer flood around the street: flow, sloshes, bubbles (shots 6-8) | -19 | -19.0 | -33.1 | +0.00 |
| 19 | 26.780 | 803.4 | vat_burst | THE VAT BURSTS: timber tear + hoop snap + beer explosion | +0 | -6.0 | -20.1 | -0.20 |
| 20 | 26.930 | 807.9 | wave_whoosh | the wave slams through the brewery wall: huge whoosh + crash | -3 | -9.0 | -23.1 | +0.00 |
| 21 | 27.130 | 813.9 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 22 | 27.180 | 815.4 | wall_crash | the back wall collapses: timber + brick debris | -6 | -12.0 | -26.1 | +0.20 |
| 23 | 27.280 | 818.4 | crowd_oofs | people knocked about by the wave: oofs and whoas | -8 | -14.0 | -28.1 | +0.00 |
| 24 | 27.580 | 827.4 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 25 | 28.030 | 840.9 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 26 | 28.400 | 852.0 | wave_slam | the wave slams the houses: second big splash | -5 | -11.0 | -25.1 | -0.10 |
| 27 | 28.480 | 854.4 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 28 | 28.930 | 867.9 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 29 | 29.380 | 881.4 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 30 | 29.830 | 894.9 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 31 | 30.100 | 903.0 | wave_slam2 | the wave reaches the far end of the street | -7 | -13.0 | -27.1 | +0.10 |
| 32 | 30.280 | 908.4 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 33 | 30.730 | 921.9 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 34 | 31.180 | 935.4 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 35 | 31.630 | 948.9 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 36 | 32.080 | 962.4 | flee_step | townspeople fleeing the wave: running footsteps on cobbles | -11 | -17.0 | -31.1 | +0.15 |
| 37 | 33.233 | 997.0 | whoosh_cam | camera cut to the scoopers | -11 | -17.0 | -31.1 | +0.00 |
| 38 | 33.400 | 1002.0 | scoop_laugh | free beer! townspeople laughing, scooping with jugs | -6 | -12.0 | -26.1 | +0.00 |
| 39 | 35.500 | 1065.0 | dazed_murmur | ...free beer. the laughter dies into a dazed murmur | -12 | -18.0 | -32.1 | +0.00 |
| 40 | 37.467 | 1124.0 | whoosh_cam | camera crossfade to golden | -11 | -17.0 | -31.1 | +0.00 |
| 41 | 37.590 | 1127.7 | amb_golden (bed, integrated) | golden-hour calm: soft breeze, blackbird phrases, faint crickets (shot 9) | -29 | -29.0 | -43.1 | +0.00 |
| 42 | 38.500 | 1155.0 | soda_shake | the kid shakes the soda bottle: fizz + rattle, faster and faster | -9 | -15.0 | -29.1 | +0.20 |
| 43 | 42.500 | 1275.0 | soda_pop | THE CAP POPS: clink + foam burst + fizz | -4 | -10.0 | -24.1 | +0.20 |
| 44 | 48.800 | 1464.0 | whoosh_cam | camera crossfade to the rebuild | -11 | -17.0 | -31.1 | +0.00 |
| 45 | 48.930 | 1467.9 | amb_street2 (bed, integrated) | rebuilt street: breeze, sparrows (shots 10-11) | -29 | -29.0 | -43.1 | +0.00 |
| 46 | 49.500 | 1485.0 | concrete_roll | a concrete vat rolls in: low rumble + wood groan | -9 | -15.0 | -29.1 | -0.20 |
| 47 | 58.400 | 1752.0 | whoosh_cam | camera crane out | -11 | -17.0 | -31.1 | +0.00 |
| 48 | 58.600 | 1758.0 | stroll_step | townspeople strolling the rebuilt street | -13 | -19.0 | -33.1 | +0.10 |
| 49 | 59.200 | 1776.0 | stroll_step | townspeople strolling the rebuilt street | -13 | -19.0 | -33.1 | +0.10 |
| 50 | 59.800 | 1794.0 | stroll_step | townspeople strolling the rebuilt street | -13 | -19.0 | -33.1 | +0.10 |
| 51 | 60.400 | 1812.0 | stroll_step | townspeople strolling the rebuilt street | -13 | -19.0 | -33.1 | +0.10 |
| 52 | 61.000 | 1830.0 | stroll_step | townspeople strolling the rebuilt street | -13 | -19.0 | -33.1 | +0.10 |
| 53 | 61.600 | 1848.0 | stroll_step | townspeople strolling the rebuilt street | -13 | -19.0 | -33.1 | +0.10 |
| 54 | 62.200 | 1866.0 | stroll_step | townspeople strolling the rebuilt street | -13 | -19.0 | -33.1 | +0.10 |
| 55 | 62.800 | 1884.0 | stroll_step | townspeople strolling the rebuilt street | -13 | -19.0 | -33.1 | +0.10 |
| 56 | 63.400 | 1902.0 | stroll_step | townspeople strolling the rebuilt street | -13 | -19.0 | -33.1 | +0.10 |
