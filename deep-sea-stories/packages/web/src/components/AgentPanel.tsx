import {
	LogIn,
	LogOut,
	BookCheck,
	OctagonMinus,
	type LucideIcon,
	MessageSquare,
} from 'lucide-react';
import type { FC, PropsWithChildren } from 'react';
import type { AgentEvent } from '@deep-sea-stories/common';
import blob from '@/assets/blob.png';
import { ScrollArea } from './ui/scroll-area';
import { useAgentEvents } from '@/hooks/useAgentEvents';

type AgentPanelProps = {
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
	<div key={timestamp} className="flex gap-3 py-1 items-start">
		<Icon size={24} className="flex-none" />
		<div className="grow flex flex-col text-sm md:text-lg">{children}</div>
		<div className="text-right flex-none text-xs md:text-sm text-muted">
			{new Date(timestamp).toLocaleTimeString()}
		</div>
	</div>
);

const renderEvent = (event: AgentEvent, index: number) => {
	switch (event.type) {
		case 'playerJoined':
			return (
				<PanelEvent
					key={`${event.timestamp}-${index}`}
					icon={LogIn}
					timestamp={event.timestamp}
				>
					<div className="text-sm md:text-lg">
						<span className="font-bold">{event.name}</span>
						<span className="text-muted-foreground"> has joined the game</span>
					</div>
				</PanelEvent>
			);
		case 'playerLeft':
			return (
				<PanelEvent
					key={`${event.timestamp}-${index}`}
					icon={LogOut}
					timestamp={event.timestamp}
				>
					<div className="text-sm md:text-lg">
						<span className="font-bold">{event.name}</span>
						<span className="text-muted-foreground"> has left the game</span>
					</div>
				</PanelEvent>
			);
		case 'gameStarted':
			return (
				<PanelEvent
					key={`${event.timestamp}-${index}`}
					icon={BookCheck}
					timestamp={event.timestamp}
				>
					<div className="text-sm md:text-lg">
						<span className="text-muted-foreground">Game Started</span>
					</div>
				</PanelEvent>
			);
		case 'gameEnded':
			return (
				<PanelEvent
					key={`${event.timestamp}-${index}`}
					icon={OctagonMinus}
					timestamp={event.timestamp}
				>
					<div className="text-sm md:text-lg">
						<span className="text-muted-foreground">Game Ended</span>
					</div>
				</PanelEvent>
			);
		case 'transcription':
			return (
				<PanelEvent
					key={`${event.timestamp}-${index}`}
					icon={MessageSquare}
					timestamp={event.timestamp}
				>
					<div className="text-sm md:text-lg font-bold grow">Storyteller</div>
					<div className="text-sm md:text-lg">
						<p>{event.text}</p>
					</div>
				</PanelEvent>
			);
	}
};

const AgentPanel: FC<AgentPanelProps> = ({ roomId }) => {
	const events = useAgentEvents(roomId);

	return (
		<div className="md:grid grid-cols-3 flex flex-col md:p-8 md:border rounded-xl h-full">
			<img
				src={blob}
				alt="agent-visualizer"
				className="object-contain hidden md:block h-24 md:h-full flex-none"
			/>
			<ScrollArea className="grow col-span-2 border rounded-xl p-3 md:p-6 md:mt-0 md:ml-4">
				{events.map((event, index) => renderEvent(event, index))}
			</ScrollArea>
		</div>
	);
};

export default AgentPanel;
