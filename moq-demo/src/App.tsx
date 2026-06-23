import { createSignal, Show } from "solid-js";
import Streamer from "./Streamer";
import Viewer from "./Viewer";
import { SANDBOX_API_URL as configSandboxApiUrl } from "./config";

export default function App() {
  const [streamName, setStreamName] = createSignal("my-stream");
  const [sandboxApiUrl, setSandboxApiUrl] = createSignal(configSandboxApiUrl);

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
            <Show when={!configSandboxApiUrl}>
              <div class="space-y-2">
                <label
                  class="text-sm font-medium leading-none"
                  for="sandbox-api-url"
                >
                  Sandbox API URL
                </label>
                <input
                  id="sandbox-api-url"
                  type="text"
                  value={sandboxApiUrl()}
                  onInput={(e) => setSandboxApiUrl(e.currentTarget.value)}
                  placeholder="https://cloud.fishjam.work/api/v1/connect/<id>/room-manager"
                  class="border-input bg-input/30 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
            </Show>
          </div>
        </div>
      </div>
      <div class="mx-auto max-w-7xl grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Streamer streamName={streamName()} sandboxApiUrl={sandboxApiUrl()} />
        <Viewer streamName={streamName()} sandboxApiUrl={sandboxApiUrl()} />
      </div>
    </div>
  );
}
