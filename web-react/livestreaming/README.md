# Fishjam Livestream Demo

This is a demo application that showcases both broadcasting and viewing live streams using Fishjam Cloud.

## Features

- **Livestream Streamer**: Start streaming your camera and microphone to a Fishjam room
- **Livestream Viewer**: Watch live streams using WHEP (WebRTC-HTTP Egress Protocol)

## Getting Started

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Fill in the values; copy the Sandbox API URL (`VITE_SANDBOX_API_URL`) from the sandbox dashboard at [https://fishjam.io/app/sandbox](https://fishjam.io/app/sandbox).

3. Start the development server:

   ```bash
   yarn dev
   ```

4. Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`)

## How to Use

### Broadcasting

1. Fill in the **Room Manager URL** (your Fishjam room manager endpoint)
2. Enter a **Room Name** for your stream
3. Enter your **Name** as the broadcaster
4. Click "Start Broadcasting" to begin streaming

### Viewing

1. Enter the **Token** for the stream you want to watch
2. Click "Connect to Stream" to start viewing
