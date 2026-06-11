# Live Translation

Live streaming with real-time AI translation — powered by [Fishjam](https://fishjam.io),
Gemini, and [Media over QUIC](https://moq.dev). A publisher broadcasts their camera and
microphone, and viewers can watch the stream with AI-generated audio translation in the
language of their choice.

## Getting Started

1. Copy `.env.example` to `.env` and fill in your Fishjam app ID:

   ```bash
   cp .env.example .env
   ```

   You can obtain `VITE_FISHJAM_ID` by visiting https://fishjam.io/app/.

2. Install dependencies:

   ```bash
   yarn
   ```

3. Start the development server:

   ```bash
   yarn dev
   ```

4. Open the printed local URL. The home page is the publisher; share the `watch/<name>`
   link with viewers to let them watch and pick a translation track.

## Environment Variables

| Variable           | Required | Description                                                                 |
| ------------------ | -------- | --------------------------------------------------------------------------- |
| `VITE_FISHJAM_ID`  | Yes      | Your Fishjam app ID, from https://fishjam.io/app/.                          |
| `VITE_MOQ_URL`     | No       | Override the Media over QUIC relay URL. Defaults to the built-in public relay. |
