# SpaceCohost Control Center

SpaceCohost is an end-to-end prototype for co-hosting live Twitter/X Spaces with an AI sidekick. It ships a browser-based control center, an Express API, and a WebSocket bridge that connects to a desktop audio processor. The system ingests live audio, generates transcripts, routes AI responses, and streams analytics so a human host can steer the show in real time.

## Feature Highlights
- **Live Control Center UI** - React + Vite single-page app with real-time meters, hotkeys, AI status, transcript timeline, personality sliders, and analytics dashboards (`client/src/pages/dashboard.tsx`).
- **Bidirectional WebSocket Hub** - `/ws` bridge fans out messages between browser operators and a desktop capture agent with support for transcripts, audio levels, control commands, AI responses, and presence events (`server/routes.ts:362`).
- **AI Pipeline Hooks** - Pluggable OpenAI integrations for Whisper transcription, GPT-4o response generation, and TTS playback; all gated behind environment keys (`server/services/openai.ts`).
- **In-Memory Domain Store** - Type-safe session, speaker, message, analytics, and memory models backed by Drizzle schemas but persisted in an in-process cache for quick demos (`server/storage.ts`).
- **Desktop Audio Capture Agents** - Production-leaning Node scripts that integrate with VoiceMeeter on Windows or provide a cross-platform simulation while speaking the WebSocket control protocol (`desktop-audio-processor.js`, `desktop-audio-processor-cross-platform.js`).
- **Desktop Simulator Toolkit** - CLI simulator, HTML dashboards, and scripts to exercise the WebSocket protocol without real hardware (`server/desktop-simulator.js`, `desktop-simulator-test.html`).

## Project Structure
- `client/` - React UI, component library, hooks, and state management via TanStack Query.
- `server/` - Express app, REST routes, WebSocket hub, OpenAI service clients, and audio helpers.
- `shared/` - Drizzle schema and shared TypeScript types used by both client and server.
- `attached_assets/` - Standalone HTML harnesses for integration, websocket, and simulator testing.
- `desktop-audio-processor.js`, `desktop-audio-processor-cross-platform.js` - Node capture agents for live host audio.
- `AUDIO_ANALYSIS.md`, `DESKTOP_SIMULATOR_README.md`, `INTEGRATION_TEST_RESULTS.md` - Design notes and experiment logs.

## Prerequisites
- Node.js 20 or newer (the OpenAI SDK and fetch usage assume modern runtime APIs).
- npm (or another Node package manager).
- Optional: An OpenAI API key with access to Whisper, GPT-4o, and TTS-1 models.
- Optional (Windows capture): VoiceMeeter Banana or Potato with its virtual inputs enabled so the desktop processor can patch in Space audio.

## Startup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server (Express + Vite dev middleware on port 5000 by default):
   ```bash
   npm run dev
   ```
   Open http://localhost:5000 to load the control center. The server seeds a demo session `demo-session-1` with mock speakers, personality, analytics, and conversation history.

### Production build
```bash
npm run build       # bundles client and server
npm run start       # serves dist/index.js with static client assets
```
Set `PORT` to override the default 5000 when deploying.

## Configuration
Environment variables are read from the process environment:
- `OPENAI_API_KEY` (or `OPENAI_API_KEY_ENV_VAR`) - enables live transcription, response generation, and speech synthesis. Without a key, API calls log warnings and the AI pipeline is effectively stubbed.
- `PORT` - server listen port (defaults to 5000).
- `WS_URL` - WebSocket endpoint used by desktop capture agents (defaults to `ws://localhost:5000/ws`).
- `SESSION_ID` - Session identifier the desktop agent joins (defaults to `demo-session-1`).
- `AUDIO_DEVICE`, `OUTPUT_DEVICE` - Optional overrides for capture and monitoring devices in the desktop agents.

## REST API Surface
All responses are JSON and use in-memory storage by default.
- `GET /api/sessions` - list sessions.
- `POST /api/sessions` - create session (auto-initialises personality and analytics).
- `GET /api/sessions/:id` - fetch session metadata.
- `PATCH /api/sessions/:id` - update session status or metadata.
- `GET /api/sessions/:id/speakers` - list speakers.
- `POST /api/sessions/:id/speakers` - add speaker.
- `GET /api/sessions/:id/messages` - timeline of conversation messages.
- `POST /api/sessions/:id/messages` - append message (broadcasts `newMessage` WebSocket event).
- `GET /api/sessions/:id/personality` / `PUT ...` - view or tune AI persona sliders.
- `GET /api/sessions/:id/analytics` - fetch operational metrics.
- `GET /api/sessions/:id/memory` - retrieve running memory (topics, speaker notes, jokes).
- `POST /api/sessions/:id/test-ai-response` - force a full AI response + TTS cycle for diagnostics.

## WebSocket Protocol (`/ws`)
Messages are JSON payloads with `{ type, source, data, timestamp }`. Key flows:
- `joinSession` and `desktop_connect` announce presence and client roles.
- Desktop emits `transcript`, `audio_levels`, and `status`; browser handlers update UI and toasts.
- Browser emits `control_command`, `requestAIResponse`, and `updatePersonality`; server fans out to desktop clients and persists state.
- Server replies with `aiResponse` (legacy) or `ai_response` carrying base64 audio, plus broadcast `hotkeyTriggered`, `personalityUpdated`, and other status notifications.
Refer to `client/src/hooks/use-websocket.tsx` and `server/routes.ts` for exact message handling.

## Desktop Audio Capture
Two Node-based capture agents are available in the project root:

### Windows + VoiceMeeter
- Requires VoiceMeeter Banana or Potato and the `voicemeeter-connector` dependency (bundled in `package.json`).
- Routes the VoiceMeeter VAIO strip into the AI cohost by default and surfaces live input/output levels.
- Start it with:
  ```bash
  WS_URL=ws://localhost:5000/ws SESSION_ID=demo-session-1 node desktop-audio-processor.js
  ```
- Keyboard controls: `space` toggles capture, `p` pauses/resumes processing, `r` reconnects the socket, `q` quits, `Ctrl+C` performs a clean shutdown.

### Cross-platform agent
- Falls back to a simulated capture pipeline on macOS and Linux while keeping the WebSocket control flow identical.
- Dynamically uses VoiceMeeter when available (Windows) and otherwise emits synthetic audio levels, transcripts, and status frames.
- Launch with:
  ```bash
  node desktop-audio-processor-cross-platform.js
  ```
- Accepts the same environment variables and keyboard shortcuts as the Windows agent.

Both agents publish audio level telemetry, invoke on-demand transcription and TTS via the server endpoints, and react to browser commands such as play/pause, skip, and personality updates in real time.

## Desktop Simulator & Test Harnesses
- `node server/desktop-simulator.js` - emulator that pushes scripted transcripts, audio levels, and reacts to browser controls. No external audio stack required.
- `node test-desktop-simulator.js` - convenience wrapper that spawns the simulator.
- `node test-ai-response.js` - smoke test to ensure AI response routing succeeds end-to-end.
- `desktop-simulator-test.html`, `integration-test.html`, `websocket-test.html` - manual testing UIs for protocol debugging.

## Frontend UX Notes
The dashboard (`client/src/pages/dashboard.tsx`) orchestrates TanStack Query data hydration, toast notifications, WebSocket hooks, hotkeys, and audio playback to provide:
- Live audio meters and waveform visualisation (`client/src/components/audio-controls.tsx`).
- Transcript timeline with speaker context, memory, and export functionality (`client/src/components/transcript-panel.tsx`).
- Personality tuning sliders that instantly persist via REST and broadcast via WebSocket (`client/src/components/personality-controls.tsx`).
- Analytics cards with shortcuts for generating intros, segues, summaries, and transcript exports (`client/src/components/analytics-panel.tsx`).

## Persistence Strategy
`server/storage.ts` implements an in-memory repository to keep the demo self-contained. The Drizzle schemas in `shared/schema.ts` map 1:1 with the storage layer, making it straightforward to swap in Postgres (e.g., Neon) by implementing the `IStorage` interface and wiring it into `server/routes.ts`.

## Recommended Next Steps
- Configure a real database adapter once you are ready to persist state between restarts.
- Swap the desktop simulator for a native capture pipeline using the provided WebSocket contract.
- Harden the AI pipeline with queueing, retries, and rate limiting before exposing to production traffic.
