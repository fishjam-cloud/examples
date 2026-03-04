# Conference to Stream

A demo showcasing Fishjam's track forwarding capability combined with [Foundry](https://compositor.live) (Smelter) for real-time video composition. Participants join a video conference, their tracks are automatically forwarded to Foundry, composed into a single stream using a Tiles layout, and made available as a WHEP stream that can be previewed alongside the conference.

## How It Works

1. The backend creates a Foundry composition and a Fishjam conference room with track forwarding enabled.
2. When a participant joins and publishes their camera/microphone, Fishjam forwards the tracks to Foundry.
3. The backend listens for `TrackForwarding` notifications via WebSocket and updates the Foundry composition layout (Tiles grid + audio mix).
4. The frontend displays the conference (via Fishjam React SDK) side-by-side with a live WHEP preview of the composed stream.

## Running Locally

Before running, copy `.env.example` to `.env` and set the following values:

```bash
FISHJAM_ID=...
FISHJAM_MANAGEMENT_TOKEN=...
VITE_FISHJAM_ID=...
```

You can get `FISHJAM_ID` and `FISHJAM_MANAGEMENT_TOKEN` for free by logging in at <https://fishjam.io/app>. `VITE_FISHJAM_ID` should be set to the same value as `FISHJAM_ID`.

### Docker Compose (Recommended)

The easiest way to run the app is with [Docker Compose](https://docs.docker.com/compose/install/).

```bash
docker compose --env-file .env up --build
```

The web UI will be available at <http://localhost:5173> and the backend at <http://localhost:8080>.

### Running Manually

#### Requirements
- [Go](https://go.dev/dl/) `>= 1.23`
- [Node.js](https://nodejs.org/en/download) `>= 20`

#### Backend

```bash
cd backend
go run main.go
```

The server starts on <http://localhost:8080> by default.

#### Frontend

```bash
cd web
npm install
npm run dev
```

Open the UI at <http://localhost:5173>.

## Repo Structure

- `backend/` — Go server that orchestrates Fishjam rooms and Foundry compositions.
  - `fishjam/` — REST client for rooms, peers, and track forwarding + WebSocket notification listener (protobuf).
  - `foundry/` — HTTP client for Foundry composition API (create, start, register/update output).
  - `handler/` — HTTP handlers and in-memory room state management.
  - `proto/` — Generated protobuf Go code for Fishjam server notifications.
- `web/` — React + Vite frontend.
  - `components/JoinForm.tsx` — Room name and user name form.
  - `components/Conference.tsx` — Peer grid with camera/mic controls + WHEP preview sidebar.
  - `components/WhepPlayer.tsx` — WHEP stream player using WebRTC.
  - `whep.ts` — WHEP client (SDP negotiation over HTTP).

### Tech Stack

- [Fishjam](https://fishjam.io) for real-time videoconferencing and track forwarding.
- [Foundry / Smelter](https://compositor.live) for real-time video composition.
- Go backend with direct HTTP/WebSocket calls (no SDK).
- React + Vite frontend with `@fishjam-cloud/react-client`.
- Tailwind CSS for styling.
