import {
	LogIn,
	LogOut,
	BookText,
	BookCheck,
	OctagonMinus,
	type LucideIcon,
	MessageSquare,
	Mic,
	MicOff,
} from 'lucide-react';
import {
	useEffect,
	useRef,
	useState,
	type FC,
	type PropsWithChildren,
} from 'react';
import type { AgentEvent } from '@deep-sea-stories/common';
import { ScrollArea } from './ui/scroll-area';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import { Button } from './ui/button';
import { useTRPCClient } from '@/contexts/trpc';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
		icon: LucideIcon;
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
		icon: MicOff,
		renderBody: (event) => (
			<div className="text-xs md:text-lg">
				<span className="text-muted-foreground">
					{event.type === 'aiAgentMutedStatusChanged' && event.muted
						? 'Agent can no longer hear players'
						: 'Agent can now hear players'}
				</span>
			</div>
		),
	},
};

const AgentPanel: FC<AgentPanelProps> = ({ roomId }) => {
	const events = useAgentEvents(roomId);
	const viewportRef = useRef<HTMLDivElement>(null);
	const trpcClient = useTRPCClient();
	const [isAiMuted, setIsAiMuted] = useState(false);
	const [isMutating, setIsMutating] = useState(false);
	const [isGameActive, setIsGameActive] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Need to scroll when events array changes
	useEffect(() => {
		if (viewportRef.current) {
			viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
		}
	}, [events.length]);

	useEffect(() => {
		const gameStartedEvents = events.filter((e) => e.type === 'gameStarted');
		const gameEndedEvents = events.filter((e) => e.type === 'gameEnded');

		const isActive = gameStartedEvents.length > gameEndedEvents.length;
		setIsGameActive(isActive);

		const lastMuteEvent = events
			.filter((e) => e.type === 'aiAgentMutedStatusChanged')
			.pop();

		if (lastMuteEvent && lastMuteEvent.type === 'aiAgentMutedStatusChanged') {
			setIsAiMuted(lastMuteEvent.muted);
		}
	}, [events]);

	const toggleAiMute = async () => {
		setIsMutating(true);
		try {
			await trpcClient.muteVoiceAgent.mutate({
				roomId,
				muted: !isAiMuted,
			});

			toast.success(
				!isAiMuted
					? 'Agent can no longer hear players'
					: 'Agent can now hear players',
			);
		} catch (error) {
			console.error('Failed to toggle AI mute:', error);
			toast.error('Failed to toggle AI hearing');
		} finally {
			setIsMutating(false);
		}
	};

	return (
		<div className="grow col-span-2 flex flex-col gap-2">
			<div className="flex justify-between items-center px-2">
				{isGameActive && (
					<Button
						onClick={toggleAiMute}
						disabled={isMutating}
						variant={isAiMuted ? 'outline' : 'default'}
						className={cn(
							'flex items-center gap-2 px-4 h-10',
							isAiMuted &&
								'border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-950',
						)}
					>
						{isAiMuted ? (
							<>
								<MicOff size={16} />
								<span className="hidden md:inline">Can't Hear</span>
							</>
						) : (
							<>
								<Mic size={16} />
								<span className="hidden md:inline">Listening</span>
							</>
						)}
					</Button>
				)}
			</div>
			<ScrollArea
				viewportRef={viewportRef}
				className="grow border rounded-xl p-2 md:p-6"
			>
				{events.map((event, index) => {
					const config = eventConfigMap[event.type];
					return (
						<PanelEvent
							key={`${event.timestamp}-${index}`}
							icon={config.icon}
							timestamp={event.timestamp}
						>
							{config.renderBody(event)}
						</PanelEvent>
					);
				})}
			</ScrollArea>
		</div>
	);
};

export default AgentPanel;
