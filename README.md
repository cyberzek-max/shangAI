# AthleteMind — Bio-Bounty Hunter

A browser-based AI gaming app that turns physical rehabilitation exercises into a
real-time 3D combat game. Your body is the controller: a webcam + MediaPipe pose
estimation tracks your movements, and every valid rep becomes an attack, a shield,
or a charge in the arena.

Fitness and play — **not medicine**. AthleteMind does not provide medical-grade
tracking and does not diagnose injuries.

## Quick start

Prerequisites: Node.js 18+ and a modern browser (Chrome/Edge recommended).

```bash
cd athletemind
npm install
npm run dev
```

Open http://localhost:5173 (localhost counts as a secure context, so the webcam
works without HTTPS). For phones/other devices on your LAN you need HTTPS or a
secure tunnel.

Other scripts:

- `npm run build` — typecheck + production build into `dist/`
- `npm run preview` — serve the production build locally
- `npm run typecheck` — TypeScript check only
- `npm run test:smoke` — headless combat-pipeline test (sim → analyzer → engine)
- `npm run test:clash` — headless clash-pipeline test (scoring, ghost FK, strikes, report)

No backend, no database. Pose runs locally in the browser; settings, XP and
session history persist in `localStorage`. MediaPipe loads its WASM runtime and
the pose model from a CDN at first launch (internet required on first run).

## Pose Clash — dual-mode pose matching (new)

Home → **Pose Clash** opens the rival setup for two disciplines:

- **Static / Flow (yoga)**: Mountain, Chair, Warrior II, Tree. Scored on joint-angle
  accuracy with per-joint tolerances; hold the pose above 70% to fill the hold
  meter. Misaligned joints glow red with correction arrows + voice cues.
- **Dynamic / Action (boxing)**: Jab·Cross·Hook and Roundhouse Flow ghost
  timelines. Velocity-based strike detection (jab, cross, hook, kick) with combo
  sync bonuses when your strike lands on the ghost's call.

**Rival sources** (picked before each session):

| Rival | How it works |
|---|---|
| Ideal ghost | Built-in reference rendered side-by-side from angle timelines |
| My ghosts | Record your own movement (saved on-device) and face it |
| Live rival | Server-free WebRTC P2P: exchange invite/answer codes, stream 33-point landmarks at ~20 Hz, interpolated ghost under 100 ms |
| Solo | No rival pane, reference checklist only |

An optional FastAPI signaling relay in `server/` automates the WebRTC handshake
on a LAN (`uvicorn signaling:app --port 8765`); the app works without it via
manual codes. After play, landmarks stream peer-to-peer and never touch the relay.

Every session ends with a **Clash Report**: average/peak accuracy, peak sync
speed (ms), strike counts, and repeated posture defects as structured JSON, plus
a one-click **Copy Claude prompt** that formats the payload for a personalized
Coach Summary, and a JSON download. Voice coaching uses the on-device Web Speech
API (no keys); the `CoachVoice` interface can wrap ElevenLabs later.

## The 2-minute demo

1. **Home → Start Game.** Grant webcam permission.
2. **Camera Setup.** Stand 2–3 m back, whole body in frame. Watch the skeleton
   overlay lock on, then press **Calibrate**.
3. **Pick Squat.** The card shows the mapped action (Charge).
4. **Fight.** Squat to build Energy, raise one arm for a side Blast, raise both
   arms and hold for **Overdrive**. Lateral raises raise a Barrier, knee lifts
   Evade.
5. **Results.** Score, reps, consistency, XP, achievements and best-vs-previous.

No webcam? Use **Demo (Simulated)** on the home screen. It drives the exact same
analysis + game pipeline with fabricated landmarks and is always badged
SIMULATED. Nothing is faked: the demo exercises the real rep counters, mapping,
cooldowns, adaptive difficulty and results.

## Movement → game mapping (configurable in `src/game/actions.ts`)

| Movement | Game action | Effect |
|---|---|---|
| Squat rep | Charge | +Energy, small score |
| Arm-raise rep | Strike | Damage + Energy |
| Left arm up | Left Blast | Damage, left VFX |
| Right arm up | Right Blast | Damage, right VFX |
| Both arms held | Overdrive (Special) | Heavy damage, costs 70 Energy |
| Lateral-raise rep | Barrier (Shield) | 1.6 s damage reduction |
| Knee-lift rep | Evade (Dodge) | 0.7 s invulnerability |

Cooldowns and a minimum hold time prevent accidental repeated actions.

## Architecture

```
src/
  pose/       MediaPipe wrapper, landmark math, demo simulator
  analysis/   joint angles, exercise rules, rep state machines, feedback
  game/       engine (webcam-free), action mapping, adaptive difficulty, session loop
  clash/      dual-mode engine: reference poses, ghost combos, smoothing,
              vector scoring, strike detection, ghost FK/recorder, TTS, reports
  net/        WebRTC P2P rival link (manual codes + optional WS signaling)
  three/      React Three Fiber arena, hero, enemy, VFX
  state/      zustand store + localStorage persistence
  components/ Home, Camera Setup, Exercise Select, Gameplay, Results,
              RivalSelect, ClashSession, ClashReport
  audio/      Web Audio synth SFX (no assets)
server/       optional FastAPI WebSocket signaling relay (live-rival handshake only)
```

Key separations:

- `game/engine.ts` never touches the webcam; feed it `PoseAnalysisResult`s from
  real pose or `pose/simulator.ts` (see `smoke/smoke.ts` for a headless test).
- `analysis/` is rule-based and explainable; the `MovementSignal`/`RepEvent`
  interface can later be fed by a trained classifier.
- Scoring is gated on pose confidence — unreliable frames never count.

## Adaptive difficulty

`game/adaptive.ts` adjusts enemy HP, attack interval and damage from completion
rate, missed reps, tracking confidence and rep cadence. It only re-evaluates
every 5 s, moves one level at a time, and never exceeds the player's chosen max
intensity (low / medium / high). Fixed Gentle / Standard / Intense presets are
available in Settings.

## Troubleshooting

- **Camera blocked / no camera** — use Demo (Simulated) mode; it is clearly labelled.
- **No pose detected** — improve front lighting, wear fitted contrasting clothes,
  keep head, hands and feet inside the frame.
- **Reps not counting** — use full range of motion (squat deep, arms fully
  overhead), move at a steady pace, and press Calibrate at setup.
- **Model fails to load** — first launch downloads from a CDN; check connectivity
  and reload.
