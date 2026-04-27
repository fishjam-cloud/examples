# MoQ Livestream Demo

A real-time video livestreaming demo built on [Media over QUIC (MoQ)](https://quicwg.org/moq-transport/). A streamer publishes a live video feed and any number of viewers can watch it with low latency using Fishjam Cloud as the MoQ relay.

## Running locally

1. Install dependencies:

```bash
yarn install
```

2. Start the development server:

```bash
yarn dev
```

3. Open the URL printed by Vite (e.g. `http://localhost:5173`).

4. Provide a **Fishjam ID** in one of two ways:
   - Pass it as a query parameter: `http://localhost:5173?fishjamId=<your-id>`
   - Leave it out — a **Fishjam ID** input field will appear in the UI so you can enter it at runtime.

5. Enter a stream name and click **Start Streaming** to publish, or **Connect to Stream** to watch.
