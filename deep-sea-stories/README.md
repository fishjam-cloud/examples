# Deep Sea Stories

Deep Sea Stories is a real-time, audio-driven game where players solve mysteries with the help of an AI riddle master.

## Running Locally

Before running locally,  make sure to copy `.env.example` to `.env` and set the following values:

```bash
FISHJAM_ID=...
FISHJAM_MANAGEMENT_TOKEN=...
GEMINI_API_KEY=...
```

- You can get `FISHJAM_ID` and `FISHJAM_MANAGEMENT_TOKEN` for free by logging in at <https://fishjam.io/app>.
- You can generate `GEMINI_API_KEY` for free at <https://aistudio.google.com/api-keys>.

### Docker Compose (Recommended)

The easiest way to run the app is with [Docker Compose](https://docs.docker.com/compose/install/).

```bash
docker compose up --build
```

You can then access the UI at <http://localhost:5000>

### Running Manually

If you can't use [docker compose](#docker-compose-recommended) to run the project, then you can follow the following steps to run the demo.

### Requirements
- [Node.js](https://nodejs.org/en/download) `>= 24`
- Yarn `4.9.2` (via [Corepack](https://github.com/nodejs/corepack))

1. Install dependencies from the repo root:
   ```bash
   corepack enable
   yarn install
   ```
2. Configure environment variables:
   - Backend (`packages/backend/.env`):
     ```bash
     FISHJAM_ID="your-fishjam-id"
     FISHJAM_MANAGEMENT_TOKEN="your-management-token"
     GEMINI_API_KEY="your-gemini-api-key"
     ```
   - Web (`packages/web/.env` or `packages/web/.env.local`):
     ```bash
     VITE_FISHJAM_ID="your-fishjam-id"
     VITE_BACKEND_URL="http://localhost:8000/api/v1"
     ```
3. Start the backend (from repo root):
   ```bash
   yarn workspace @deep-sea-stories/backend start
   ```
4. Start the web client in another terminal (from repo root):
   ```bash
   yarn workspace @deep-sea-stories/web start
   ```
5. Open the UI at <http://localhost:5173>.

## Repo Structure

- `packages/backend`: Fishjam Agent which talks with Google Gemini Live API.
- `packages/web`: Web client, which connects to the backend and Fishjam in the browser.
- `packages/common`: Shared TypeScript types and utilities.
- `docker-compose.yml` + `nginx.conf`: Container setup with a reverse proxy.

### Tech Stack

- Yarn workspaces monorepo with Fastify + tRPC (backend), React + Vite (frontend).
- [Fishjam](https://fishjam.swmansion.com) for real-time videoconferencing capabilities.
- [Gemini Live API](https://ai.google.dev/gemini-api/docs/live) for AI riddle master backend.

