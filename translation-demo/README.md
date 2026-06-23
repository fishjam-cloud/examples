# Translation Demo

An example React app that streams over the MoQ protocol with Fishjam, with live audio translation and captions for the viewer.

## Getting Started

Install dependencies:

```bash
yarn
```

Configure the sandbox API URL (required):

```bash
cp .env.example .env
# then set VITE_SANDBOX_API_URL in .env to your Fishjam sandbox API URL
```

Start the development server:

```bash
yarn dev
```

## Environment Variables

- `VITE_SANDBOX_API_URL` (required) — Fishjam sandbox API URL used to fetch a MoQ relay connection URL. Get it at https://fishjam.io/app/sandbox.
