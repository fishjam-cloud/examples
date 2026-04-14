# Conference to Stream

A demo showcasing Fishjam's track forwarding capability combined with [Composition API](https://fishjam.io/docs/composition-api/introduction) for real-time video composition. Participants join a video conference, their tracks are automatically forwarded to Composition API, composed into a single stream using a Tiles layout, and made available as a WHEP stream that can be previewed alongside the conference.

## How It Works

1. The backend creates a Composition API composition and a Fishjam conference room with track forwarding enabled.
2. When a participant joins and publishes their camera/microphone, Fishjam forwards the tracks to Composition API.
3. The backend listens for `TrackForwarding` notifications via WebSocket and updates the Composition API composition layout (Tiles grid + audio mix).
4. The frontend displays the conference (via Fishjam React SDK) side-by-side with a live WHEP preview of the composed stream.

## Running Locally

Before running, copy `.env.example` to `.env` and set the following values:

```bash
# Fishjam ID or full URL (e.g. your-id or https://fishjam.io/api/v1/connect/your-id)
FISHJAM_ID=your-fishjam-id

# Fishjam management token
FISHJAM_MANAGEMENT_TOKEN=your-management-token

# Composition API base URL (default: https://rtc.fishjam.io)
COMPOSITION_API_URL=https://rtc.fishjam.io

# Backend port (default: 8080)
PORT=8080

# Frontend: backend URL
VITE_BACKEND_URL=http://localhost:8080
```

You can get `FISHJAM_ID` and `FISHJAM_MANAGEMENT_TOKEN` for free by logging in at <https://fishjam.io/app>.

### Docker Compose (Recommended)

The easiest way to run the app is with [Docker Compose](https://docs.docker.com/compose/install/).

```bash
docker compose --env-file .env up --build
```

The web UI will be available at <http://localhost:5173> and the backend at <http://localhost:8080>.

### Running Manually

#### Requirements
- [Go](https://go.dev/dl/) `>= 1.24`
- [Node.js](https://nodejs.org/en/download) `>= 22`

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

- `backend/` — Go server that orchestrates Fishjam rooms and Composition API compositions.
  - `composition/` — HTTP client for Composition API (create, start, update output).
  - `fishjam/` — REST client for rooms, peers, and track forwarding (generated via `oapi-codegen`) + WebSocket notification listener.
  - `handler/` — HTTP handlers and in-memory room state management.
  - `proto/` — Generated protobuf Go code for Fishjam server notifications.
- `web/` — React + Vite frontend.
  - `src/components/JoinForm.tsx` — Room name and user name form.
  - `src/components/Conference.tsx` — Peer grid with camera/mic controls + WHEP preview sidebar.
  - `src/components/WhepPlayer.tsx` — Live stream player using `@fishjam-cloud/react-client`.
  - `src/api.ts` — API client for communicating with the Go backend.

### Tech Stack

- [Fishjam](https://fishjam.io) for real-time videoconferencing and track forwarding.
- [Composition API](https://fishjam.io/docs/composition-api/introduction) for real-time video composition.
- Go backend with `oapi-codegen` generated REST client and WebSocket for notifications.
- React + Vite frontend with `@fishjam-cloud/react-client`.
- Tailwind CSS v4 for styling.
