import { Check, CircleX, EarOff, Headphones } from 'lucide-react';
import { type FC, useEffect, useState } from 'react';
import { useTRPCClient } from '@/contexts/trpc';
import { useAgentEvents } from '@/hooks/useAgentEvents';
import { Button } from './ui/button';
import { toast } from './ui/sonner';

type AgentModeToggleProps = {
	roomId: string;
};

const AgentModeToggle: FC<AgentModeToggleProps> = ({ roomId }) => {
	const trpcClient = useTRPCClient();
	const events = useAgentEvents(roomId);
	const [isAiMuted, setIsAiMuted] = useState(false);
	const [isMutating, setIsMutating] = useState(false);
	const [isGameActive, setIsGameActive] = useState(false);

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

			toast(!isAiMuted ? 'Agent deafened' : 'Agent listening', Check);
		} catch (error) {
			console.error(error);
			const verb = isAiMuted ? 'undeafen' : 'deafen';
			toast(`Failed to ${verb} agent`, CircleX);
		} finally {
			setIsMutating(false);
		}
	};

	if (!isGameActive) {
		return null;
	}

	return (
		<div className="flex justify-center px-2">
			<Button
				onClick={toggleAiMute}
				disabled={isMutating}
				variant="outline"
				className="flex items-center gap-2 px-4 h-10 w-full"
			>
				{isAiMuted ? (
					<>
						<Headphones size={16} />
						<span>Undeafen Agent</span>
					</>
				) : (
					<>
						<EarOff size={16} />
						<span>Deafen Agent</span>
					</>
				)}
			</Button>
		</div>
	);
};

export default AgentModeToggle;
