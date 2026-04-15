import { createSignal, Show } from "solid-js";
import "@moq/publish/ui";
import "@moq/publish/element";

const BASE_URL = "https://moq.fishjam.work:443/fishjam";

interface Props {
	streamName: string;
}

export default function Streamer(props: Props) {
	let publishEl!: HTMLElement;
	const [token, setToken] = createSignal("");
	const [connected, setConnected] = createSignal(false);
	const [error, setError] = createSignal<string | undefined>(undefined);

	function start() {
		setError(undefined);
		try {
			const url = `${BASE_URL}/${encodeURIComponent(props.streamName)}?jwt=${token()}`;
			publishEl.setAttribute("url", url);
			publishEl.setAttribute("name", props.streamName);
			setConnected(true);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
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
				<div class="text-muted-foreground text-sm">Start streaming to the room</div>
			</div>

			{/* Card content */}
			<div class="px-6 space-y-4">
				<div class="space-y-2">
					<label class="text-sm font-medium leading-none" for="streamer-token">
						JWT Token
					</label>
					<input
						id="streamer-token"
						type="text"
						placeholder="eyJ..."
						value={token()}
						onInput={(e) => setToken(e.currentTarget.value)}
						disabled={connected()}
						class="border-input bg-input/30 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
					/>
				</div>

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
							disabled={!token() || !props.streamName}
							class="inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 w-full"
						>
							Start Streaming
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
