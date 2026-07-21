# Translation Service

Async Python service that announces live AI-translated audio and captions for
MoQ audio broadcasts, powered by Google Gemini Live.

For each source broadcast announced by the relay, the service reads the Hang
catalog, finds a supported audio track, and announces a sibling dynamic
broadcast at:

```text
<source>/<provider>/translation
```

Subscribers request a target language by subscribing to a track named with the
language code, for example `es` or `pt-BR`. Translation starts on demand: the
provider session opens when the first subscriber requests a language and closes
shortly after the last one leaves.

While a translated audio track is active, subscribers can request its live
transcript on a track named `<language>/transcript.json`. Transcript frames are
UTF-8 JSON replace-state payloads:

```json
{"segments": [{"text": "Hola", "ts_us": 0, "final": false}]}
```

## Run

```bash
uv sync
uv run --env-file ../.env translator
```

The service fetches a MoQ token from Fishjam using a management token and
reconnects with a fresh token before the hourly expiry. A single instance
covers all streams in the account, including ones published after it starts.

## Environment variables

- `FISHJAM_ID`, `FISHJAM_MANAGEMENT_TOKEN` — Fishjam credentials used to mint
  MoQ tokens. Get them at https://fishjam.io/app.
- `GEMINI_API_KEY` — Google Gemini API key (`GOOGLE_API_KEY` is accepted as a
  fallback).

## Useful flags

- `--prefix` — only watch broadcasts under this path prefix (default: all
  streams in the account).
- `--google-model` — override the Gemini Live translation model (default
  `models/gemini-3.5-live-translate-preview`).
- `--url` — connect directly to a MoQ relay without Fishjam authentication
  (local development); combine with `--no-tls-verify` for self-signed relays.
- `--log-level DEBUG` — verbose logging.

## Notes

- Supported target languages come from the Gemini Live Translate BCP-47
  language list; unsupported language requests are closed without opening a
  provider session.
- Opus and AAC sources are supported. Output mirrors the source codec family.
- Transcript tracks are scoped to an active audio language track and close when
  that audio translation stops.
