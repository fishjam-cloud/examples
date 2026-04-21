import { createSignal } from "solid-js";
import Streamer from "./Streamer";
import Viewer from "./Viewer";

const fishjamId = window.location.pathname.split("/").filter(Boolean)[0] ?? "";

export default function App() {
  const [streamName, setStreamName] = createSignal("my-stream");

  return (
    <div class="min-h-screen bg-background p-8">
      <div class="mb-8 flex flex-col items-center gap-2">
        <h1 class="text-3xl font-bold">MoQ Livestream Demo</h1>
        <p class="text-muted-foreground">
          Broadcast and view live streams over MoQ
        </p>
        <div class="mt-4 w-full max-w-xs">
          <div class="bg-card text-card-foreground flex flex-col gap-4 rounded-xl border py-6 shadow-sm px-6">
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none" for="stream-name">
                Stream name
              </label>
              <input
                id="stream-name"
                type="text"
                value={streamName()}
                onInput={(e) => setStreamName(e.currentTarget.value)}
                placeholder="my-stream"
                class="border-input bg-input/30 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          </div>
        </div>
      </div>
      <div class="mx-auto max-w-7xl grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Streamer streamName={streamName()} fishjamId={fishjamId} />
        <Viewer streamName={streamName()} fishjamId={fishjamId} />
      </div>
    </div>
  );
}
