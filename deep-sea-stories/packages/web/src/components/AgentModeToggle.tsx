import { useEffect, useState, type FC } from 'react';
import { Users, Bot } from 'lucide-react';
import { Button } from './ui/button';
import { useTRPCClient } from '@/contexts/trpc';
import { toast } from 'sonner';
import { useAgentEvents } from '@/hooks/useAgentEvents';

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

			toast.success(
				!isAiMuted
					? 'Switched to conference mode'
					: 'Switched to agent question mode',
			);
		} catch (error) {
			console.error('Failed to toggle AI mode:', error);
			toast.error('Failed to toggle mode');
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
						<Users size={16} />
						<span>Conference Mode</span>
					</>
				) : (
					<>
						<Bot size={16} />
						<span>Agent Question Mode</span>
					</>
				)}
			</Button>
		</div>
	);
};

export default AgentModeToggle;
