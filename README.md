# ShangAI

**A camera-powered movement game where your body becomes the controller.** ShangAI uses on-device pose estimation to turn exercise and movement practice into solo challenges, ghost matchups, and live head-to-head arena rounds.

## What it does

- Tracks one person's 33-body-landmark pose in the browser with MediaPipe Pose Landmarker.
- Supports guided exercise gameplay, reference-pose clashes, and locally recorded movement ghosts.
- Scores movement alignment and strikes, then produces a session report that can be inspected, downloaded as JSON, or copied as a prompt for an external AI assistant. No AI service is called by the app.
- Offers live friend matches. WebRTC sends pose landmarks directly between browsers; a small HTTP signaling function exchanges connection setup messages through Upstash Redis.
- Saves preferences, progress, achievements, and recent session history in browser local storage.

## Get started

1. Open the deployed app in a modern browser and allow camera access.
2. Follow the on-screen framing instructions. A well-lit space with your full body visible works best.
3. For live play, open **Live Multiplayer Arena** on two devices. One player hosts a room and shares the invite link; the other opens it and joins. Allow camera access on both devices. Keep both tabs open during the match.

Camera sessions require HTTPS (or localhost). Live peer connectivity depends on the players' networks and browser WebRTC support; this deployment uses a public STUN server and does not include a TURN relay, so restrictive NAT/firewall combinations may prevent a direct connection.

## Run locally

Requirements: Node.js 20 or later and npm.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. To create the production bundle:

```bash
npm run build
npm run preview
```

The pose model and MediaPipe WASM runtime are served from `public/` on the same origin as the app. First camera use downloads these assets; allow several megabytes of transfer. `npm run build` also copies the frontend output to `server/dist` for the optional Python server.

## Live signaling deployment

The Vercel deployment uses `api/signal.ts` and requires a shared Upstash Redis database because Vercel Functions do not share process memory. Configure these environment variables in the Vercel project and redeploy:

```text
UPSTASH_REDIS_REST_URL=https://<your-database>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-rest-token>
```

The signaling API retains offer/answer data for up to 15 minutes. It exchanges WebRTC session descriptions only; gameplay landmarks are sent peer-to-peer over the data channel. Never commit real credentials or put them in client-side `VITE_` variables.

An optional in-memory FastAPI WebSocket signaling relay is available under `server/` for self-hosted deployments. It is not used by the Vercel app.

## Privacy and safety

- Pose inference runs in the browser. Camera frames are not uploaded by this application.
- For live matches, pose landmark coordinates are sent to the other participant over WebRTC. The signaling service exchanges connection metadata (SDP), not video.
- Progress and settings stay in local storage on the current browser/device; they are not account-synced.
- ShangAI is a movement game, not medical advice or a diagnostic/rehabilitation device. Stop if movement causes pain or discomfort and use a safe, clear practice area.

## Stack and project map

- React, TypeScript, Vite, Tailwind CSS, Zustand
- MediaPipe Tasks Vision Pose Landmarker; HTML Canvas and Three.js for visualizations
- WebRTC data channels for live peer movement and Upstash-backed Vercel signaling
- Optional FastAPI WebSocket signaling relay (`server/`)

```text
src/analysis/       Exercise metrics and rep analysis
src/clash/          Clash scoring, pose references, ghosts, and reports
src/components/     App screens and interactive UI
src/game/           Game rules, adaptive difficulty, and runtime
src/net/            WebRTC peer transport and signaling client
src/pose/           MediaPipe pose service
src/state/          App store and local persistence
api/signal.ts       Vercel/Upstash HTTP signaling endpoint
```

## Quality checks

```bash
npm run build
npm run test:smoke
npm run test:clash
```

These checks cover TypeScript/production compilation and scoring behavior. Browser camera permissions, device performance, and two-network WebRTC connectivity still need hands-on device testing.
