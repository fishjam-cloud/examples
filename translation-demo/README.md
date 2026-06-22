# Translation Demo

An example React app that streams over the MoQ protocol with Fishjam, with live audio translation and captions for the viewer.

## Getting Started

Install dependencies:

```bash
yarn
```

Configure the MoQ relay (required):

```bash
cp .env.example .env
# then set VITE_MOQ_URL and VITE_MOQ_FISHJAM_ID in .env to your MoQ relay URL
```

Start the development server:

```bash
yarn dev
```

## Environment Variables

- `VITE_MOQ_URL` (required) — URL of the MoQ relay to connect to. The app has no built-in default and will not connect until this is set.
