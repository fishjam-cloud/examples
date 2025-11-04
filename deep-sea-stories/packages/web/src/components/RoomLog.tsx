import { LogIn, type LucideIcon, MessageSquare } from 'lucide-react';
import type { FC, PropsWithChildren } from 'react';
import type { AgentEvent } from '@deep-sea-stories/common';
import { ScrollArea } from './ui/scroll-area';

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
		<div className="text-right flex-none text-xs md:text-sm text-muted-foreground">
			{new Date(timestamp).toLocaleTimeString()}
		</div>
	</div>
);

const renderEvent = (event: AgentEvent) => {
	switch (event.type) {
		case 'join':
			return (
				<PanelEvent icon={LogIn} timestamp={event.timestamp}>
					<div>
						<span className="font-bold">{event.name}</span>
						<span className="text-muted-foreground"> has joined the game</span>
					</div>
				</PanelEvent>
			);
		case 'transcription':
			return (
				<PanelEvent icon={MessageSquare} timestamp={event.timestamp}>
					<div className=" font-bold grow">Storyteller</div>
					<div>
						<p>{event.text}</p>
					</div>
				</PanelEvent>
			);
	}
};

const AgentPanel = () => {
	const events: AgentEvent[] = [
		{
			type: 'join',
			name: 'Gordon',
			timestamp: Date.now(),
		},
		{
			type: 'transcription',
			text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed laoreet, dui quis tempus varius, ex ipsum suscipit ipsum, sed varius nunc arcu in lorem.',
			timestamp: Date.now() + 1000 * 60 * 7,
		},
	];

	return (
		<ScrollArea className="border rounded-xl px-3 py-2 md:p-6 mx-4 mb-4">
			{events.map(renderEvent)}
		</ScrollArea>
	);
};

export default AgentPanel;
