# Gemini Demo

A minimal example of a video call with a Gemini Live AI agent using Fishjam Cloud.

## What it does

- Create a room and join a video call
- Spawn a Gemini Live voice agent with a custom system prompt
- The agent joins the call, listens to participants, and responds with voice
- Supports Google Search for real-time information

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials:

```
cp .env.example .env
```

2. Install dependencies:

```
cd backend && npm install
cd ../web && npm install
```

3. Start the backend:

```
cd backend && npm run start
```

4. Start the frontend (in another terminal):

```
cd web && npm run start
```

5. Open http://localhost:5173

## Architecture

```
backend/src/main.ts   - Fastify + tRPC server, Fishjam SDK, Gemini Live API
web/src/App.tsx        - React frontend with Fishjam React Client
web/src/trpc.ts        - tRPC client setup
```

### Audio flow

```
Peer audio (16kHz) → Fishjam Agent → Gemini Live API
                                          ↓
                    Fishjam Agent Track ← Gemini response (24kHz)
                          ↓
                    All peers hear the agent
```
