import { LogIn, type LucideIcon, MessageSquare } from 'lucide-react';
import type { FC, PropsWithChildren } from 'react';
import { useState, useEffect } from 'react';
import type { AgentEvent } from '@deep-sea-stories/common';
import blob from '@/assets/blob.png';
import { ScrollArea } from './ui/scroll-area';
import { useTRPCClient } from '@/contexts/trpc';

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
		<div className="grow flex flex-col text-lg">{children}</div>
		<div className="text-right flex-none text-sm text-muted">
			{new Date(timestamp).toLocaleTimeString()}
		</div>
	</div>
);

const renderEvent = (event: AgentEvent) => {
	switch (event.type) {
		case 'join':
			return (
				<PanelEvent icon={LogIn} timestamp={event.timestamp}>
					<div className="text-lg">
						<span className="font-bold">{event.name}</span>
						<span className="text-muted-foreground"> has joined the game</span>
					</div>
				</PanelEvent>
			);
		case 'transcription':
			return (
				<PanelEvent icon={MessageSquare} timestamp={event.timestamp}>
					<div className="text-lg font-bold grow">Storyteller</div>
					<div className="text-lg">
						<p>{event.text}</p>
					</div>
				</PanelEvent>
			);
	}
};

const AgentPanel = () => {
	const [events, setEvents] = useState<AgentEvent[]>([]);
	const trpcClient = useTRPCClient();

	useEffect(() => {
		const subscription = trpcClient.Notifications.subscribe(undefined, {
			onData: (event: AgentEvent) => {
				setEvents((prev) => [...prev, event]);
			},
			onError: (error: unknown) => {
				console.error('Subscription error:', error);
			},
		});

		return () => {
			subscription.unsubscribe();
		};
	}, [trpcClient]);

	return (
		<div className="grid grid-cols-3 p-8 border rounded-xl">
			<img
				src={blob}
				alt="agent-visualizer"
				className="object-contain h-full"
			/>
			<ScrollArea className="grow col-span-2 border rounded-xl p-6">
				{events.map(renderEvent)}
			</ScrollArea>
		</div>
	);
};

export default AgentPanel;
