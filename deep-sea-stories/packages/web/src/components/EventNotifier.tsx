import type { AgentEvent } from '@deep-sea-stories/common';
import {
	BookCheck,
	BookText,
	BookUp,
	EarOff,
	Headphones,
	LogIn,
	LogOut,
	type LucideIcon,
	MessageSquare,
	OctagonMinus,
} from 'lucide-react';
import { type FC, type PropsWithChildren, useEffect, useRef } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';

type EventNotifierProps = {
	roomId: string;
};

type PanelEventProps = {
	icon: LucideIcon;
	timestamp: number;
};

const PanelEvent: FC<PropsWithChildren<PanelEventProps>> = ({
	icon: Icon,
	children,
	timestamp,
}) => (
	<div key={timestamp} className="flex gap-2 md:gap-3 py-1 items-start">
		<Icon size={16} className="flex-none md:w-6 md:h-6" />
		<div className="grow flex flex-col text-xs md:text-lg">{children}</div>
		<div className="text-right flex-none text-[10px] md:text-sm text-muted">
			{new Date(timestamp).toLocaleTimeString()}
		</div>
	</div>
);

const eventConfigMap: Record<
	Exclude<AgentEvent['type'], 'VAD'>,
	{
		icon: LucideIcon | ((event: AgentEvent) => LucideIcon);
		renderBody: (event: AgentEvent) => React.ReactElement;
	}
> = {
	playerJoined: {
		icon: LogIn,
		renderBody: (event) => (
			<div className="text-xs md:text-lg">
				<span className="font-bold">
					{event.type === 'playerJoined' ? event.name : ''}
				</span>
				<span className="text-muted-foreground"> has joined the game</span>
			</div>
		),
	},
	playerLeft: {
		icon: LogOut,
		renderBody: (event) => (
			<div className="text-xs md:text-lg">
				<span className="font-bold">
					{event.type === 'playerLeft' ? event.name : ''}
				</span>
				<span className="text-muted-foreground"> has left the game</span>
			</div>
		),
	},
	gameStarted: {
		icon: BookCheck,
		renderBody: () => (
			<div className="text-xs md:text-lg">
				<span className="text-muted-foreground">Game Started</span>
			</div>
		),
	},
	storySelected: {
		icon: BookText,
		renderBody: (event) => (
			<div className="text-xs md:text-lg">
				<span className="font-bold">
					{event.type === 'storySelected' ? event.userName : ''}
				</span>
				<span className="text-muted-foreground"> selected story </span>
				<span className="font-bold">
					{event.type === 'storySelected' ? event.storyTitle : ''}
				</span>
			</div>
		),
	},
	gameEnded: {
		icon: OctagonMinus,
		renderBody: () => (
			<div className="text-xs md:text-lg">
				<span className="text-muted-foreground">Game Ended</span>
			</div>
		),
	},
	transcription: {
		icon: MessageSquare,
		renderBody: (event) => (
			<>
				<div className="text-xs md:text-lg font-bold grow">Storyteller</div>
				<div className="text-xs md:text-lg">
					<p>{event.type === 'transcription' ? event.text : ''}</p>
				</div>
			</>
		),
	},
	aiAgentMutedStatusChanged: {
		icon: (event: AgentEvent) =>
			event.type === 'aiAgentMutedStatusChanged' && event.muted
				? EarOff
				: Headphones,
		renderBody: (event) => (
			<div className="text-xs md:text-lg">
				<span className="text-muted-foreground">
					{event.type === 'aiAgentMutedStatusChanged' && event.muted
						? 'Agent deafened'
						: 'Agent listening'}
				</span>
			</div>
		),
	},
};

const EventNotifier: FC<EventNotifierProps> = ({ roomId }) => {
	const events = useAgentEvents(roomId);
	const viewportRef = useRef<HTMLDivElement>(null);
	const firstTranscriptionRef = useRef<HTMLDivElement>(null);

	const filteredEvents = events.filter((event) => event.type !== 'VAD');
	const firstTranscriptionIndex = filteredEvents.findIndex(
		(event) => event.type === 'transcription',
	);
	const hasTranscription = firstTranscriptionIndex !== -1;

	const scrollToStory = () => {
		firstTranscriptionRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: Need to scroll when events array changes
	useEffect(() => {
		if (viewportRef.current) {
			viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
		}
	}, [events.length]);

	return (
		<ScrollArea
			viewportRef={viewportRef}
			className="flex-1 lg:w-2/3 border rounded-3xl bg-card min-h-0 lg:m-2 xl:m-2"
		>
			{hasTranscription && (
				<Button
					variant="outline"
					size="sm"
					onClick={scrollToStory}
					className="absolute top-2 right-4 z-10 gap-1"
				>
					<BookUp size={16} />
					<span className="hidden md:inline">Go to story</span>
				</Button>
			)}
			<div className="p-3 md:p-6">
				{filteredEvents.map((event, index) => {
					const config = eventConfigMap[event.type];
					const icon = (
						typeof config.icon === 'function'
							? config.icon(event)
							: config.icon
					) as LucideIcon;
					const isFirstTranscription = index === firstTranscriptionIndex;
					return (
						<div
							key={`${event.timestamp}-${index}`}
							ref={isFirstTranscription ? firstTranscriptionRef : undefined}
						>
							<PanelEvent icon={icon} timestamp={event.timestamp}>
								{config.renderBody(event)}
							</PanelEvent>
						</div>
					);
				})}
			</div>
		</ScrollArea>
	);
};

export default EventNotifier;
