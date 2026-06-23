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

4. Provide the **Sandbox API URL** (the relay connection URL, including the Fishjam ID, is returned by the sandbox):

   - Pass it as a query parameter: `http://localhost:5173?sandboxApiUrl=https://fishjam.io/api/v1/connect/<your-key>/room-manager`
   - Or enter it in the UI at runtime.

5. Enter a stream name and click **Start Streaming** to publish, or **Connect to Stream** to watch.
