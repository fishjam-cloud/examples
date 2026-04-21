import { createSignal, Show } from "solid-js";
import "@moq/publish/ui";
import "@moq/publish/element";

const BASE_URL = "https://moq.fishjam.work:443";

interface Props {
  streamName: string;
  fishjamId: string;
}

export default function Streamer(props: Props) {
  let publishEl!: HTMLElement;
  const [connected, setConnected] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | undefined>(undefined);

  async function start() {
    setError(undefined);
    setLoading(true);
    try {
      const res = await fetch(
        `https://cloud.fishjam.work/api/v1/connect/${props.fishjamId}/room-manager/moq/${encodeURIComponent(props.streamName)}/publisher`,
      );
      if (!res.ok) throw new Error(await res.text());
      const { token } = (await res.json()) as { token: string };
      const url = `${BASE_URL}/${props.fishjamId}?jwt=${token}`;
      publishEl.setAttribute("url", url);
      publishEl.setAttribute("name", props.streamName);
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function stop() {
    publishEl.removeAttribute("url");
    setConnected(false);
  }

  return (
    <div class="bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm">
      {/* Card header */}
      <div class="px-6 space-y-1.5">
        <div class="leading-none font-semibold">Livestream Streamer</div>
        <div class="text-muted-foreground text-sm">
          Start streaming to the room
        </div>
      </div>

      {/* Card content */}
      <div class="px-6 space-y-4">
        <Show when={error()}>
          <div class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span class="mt-0.5 shrink-0">⚠</span>
            <span>{error()}</span>
          </div>
        </Show>

        {/*
         * Publisher element is always in the DOM so the `ref` is valid before
         * the user clicks "Start Streaming". It is hidden via CSS until connected.
         */}
        <Show when={!connected()}>
          <div class="relative overflow-hidden rounded-lg bg-input/30 aspect-video flex items-center justify-center text-sm text-muted-foreground">
            Camera preview will appear here
          </div>
        </Show>
        <div classList={{ hidden: !connected() }}>
          <moq-publish-ui>
            <moq-publish ref={publishEl}>
              <video
                muted
                autoplay
                style="width: 100%; height: auto; border-radius: var(--radius-md);"
              />
            </moq-publish>
          </moq-publish-ui>
        </div>
      </div>

      {/* Card footer */}
      <div class="px-6 mt-auto">
        <Show
          when={connected()}
          fallback={
            <button
              type="button"
              onClick={start}
              disabled={!props.streamName || !props.fishjamId || loading()}
              class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 w-full"
            >
              {loading() ? "Connecting…" : "Start Streaming"}
            </button>
          }
        >
          <button
            type="button"
            onClick={stop}
            class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all bg-destructive text-white shadow-xs hover:bg-destructive/90 h-9 px-4 py-2 w-full"
          >
            Stop Streaming
          </button>
        </Show>
      </div>
    </div>
  );
}
