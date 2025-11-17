import {
	LogIn,
	LogOut,
	BookText,
	BookCheck,
	OctagonMinus,
	type LucideIcon,
	MessageSquare,
	Users,
	Bot,
} from 'lucide-react';
import { useEffect, useRef, type FC, type PropsWithChildren } from 'react';
import type { AgentEvent } from '@deep-sea-stories/common';
import { ScrollArea } from './ui/scroll-area';
import { useAgentEvents } from '@/hooks/useAgentEvents';

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
	AgentEvent['type'],
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
			event.type === 'aiAgentMutedStatusChanged' && event.muted ? Users : Bot,
		renderBody: (event) => (
			<div className="text-xs md:text-lg">
				<span className="text-muted-foreground">
					{event.type === 'aiAgentMutedStatusChanged' && event.muted
						? 'Switched to Conference Mode'
						: 'Switched to Agent Question Mode'}
				</span>
			</div>
		),
	},
};

const EventNotifier: FC<EventNotifierProps> = ({ roomId }) => {
	const events = useAgentEvents(roomId);
	const viewportRef = useRef<HTMLDivElement>(null);

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
			<div className="p-3 md:p-6">
				{events.map((event, index) => {
					const config = eventConfigMap[event.type];
					const icon = (
						typeof config.icon === 'function' ? config.icon(event) : config.icon
					) as LucideIcon;
					return (
						<PanelEvent
							key={`${event.timestamp}-${index}`}
							icon={icon}
							timestamp={event.timestamp}
						>
							{config.renderBody(event)}
						</PanelEvent>
					);
				})}
			</div>
		</ScrollArea>
	);
};

export default EventNotifier;
