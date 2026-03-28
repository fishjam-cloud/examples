# Gemini Live x Fishjam Cloud Demo

A video call where you can invite a Gemini Live AI agent into the room. The agent hears everyone, sees your camera, responds with voice, and can search the web for real-time answers. Participants can customize the agent's behavior with a system prompt.

## Running locally

1. Copy `.env.example` to `.env` and fill in your Fishjam and Gemini credentials:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
yarn install
```

3. Start the backend and frontend in separate terminals:

```bash
cd backend && yarn start
cd web && yarn start
```

4. Open http://localhost:5173
