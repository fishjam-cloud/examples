# Translation Demo

Live MoQ streaming with real-time AI audio translation and captions, built on
Fishjam. The demo has two parts:

- **Web app** — a React app for publishing a stream and
  watching it, with a translation menu and live captions on the watch page.
- **Translation service** (`service/`) — a Python service that subscribes to
  every stream and announces AI-translated audio and caption tracks
  which the web app picks up.

Both are needed for translations: the watch page's translation menu only shows
languages while the service is running.

## Prerequisites

- A Fishjam account (https://fishjam.io/app) — you'll need the sandbox API URL,
  your Fishjam ID, and a management token.
- A Gemini API key for the translation provider.
- Node.js with Yarn, Python 3.11+, and [uv](https://docs.astral.sh/uv/).

## Setup

Configure credentials once for both parts:

```bash
cp .env.example .env
# fill in VITE_SANDBOX_API_URL, FISHJAM_ID, FISHJAM_MANAGEMENT_TOKEN,
# and GEMINI_API_KEY
```

## Run the translation service

```bash
cd service
uv sync
uv run --env-file ../.env translator
```

Translation is powered by Google Gemini Live. See `service/README.md` for details.

## Run the web app

```bash
yarn
yarn dev
```

Open the printed URL and publish a stream, then open the viewer link shown in
the publisher panel (the watch page) in another tab and pick a translation
language.

## Environment Variables

- `VITE_SANDBOX_API_URL` (web app) — Fishjam sandbox API URL used to fetch a MoQ relay connection URL. Get it at https://fishjam.io/app/sandbox.
- `FISHJAM_ID`, `FISHJAM_MANAGEMENT_TOKEN` (translation service) — Fishjam credentials used to mint MoQ tokens. Get them at https://fishjam.io/app.
- `GEMINI_API_KEY` (translation service) — Google Gemini API key used for translation.
