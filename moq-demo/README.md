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

3. Open the URL printed by Vite (e.g. `http://localhost:5173`) and append a Fishjam room ID to the path:

```
http://localhost:5173/<fishjam-room-id>/
```

4. Enter a stream name and click **Start Streaming** to publish, or **Connect to Stream** to watch.
