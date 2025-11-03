import { Check } from 'lucide-react';
import type { FC } from 'react';
import { useEffect, useState } from 'react';
import CopyButton from './CopyButton';
import HowItWorks from './HowItWorks';
import HowToPlay from './HowToPlay';
import StorySelectionPanel from './StorySelectionPanel';
import { Button } from './ui/button';
import { toast } from './ui/sonner';
import { useTRPCClient } from '@/contexts/trpc';
import { useAgentEvents } from '@/hooks/useAgentEvents';

export type RoomControlsProps = {
	roomId: string;
	userName: string;
};

const RoomControls: FC<RoomControlsProps> = ({ roomId, userName }) => {
	const url = `https://deepsea.fishjam.io/${roomId}`;
	const [isStoryPanelOpen, setIsStoryPanelOpen] = useState(false);
	const [selectedStoryId, setSelectedStoryId] = useState<number | null>(null);
	const [isGameActive, setIsGameActive] = useState(false);
	const [isCanceling, setIsCanceling] = useState(false);
	const [isStarting, setIsStarting] = useState(false);
	const trpc = useTRPCClient();
	const events = useAgentEvents(roomId);

	useEffect(() => {
		void trpc.getStories.query();
	}, [trpc]);

	useEffect(() => {
		const reverseEvents = [...events].reverse();
		const lastGameEndedIndex = reverseEvents.findIndex(
			(event) => event.type === 'gameEnded',
		);
		const startIndex =
			lastGameEndedIndex === -1 ? 0 : events.length - lastGameEndedIndex;

		setSelectedStoryId(null);
		setIsGameActive(false);
		for (let i = startIndex; i < events.length; i++) {
			const event = events[i];
			if (event.type === 'storySelected') {
				setSelectedStoryId(event.storyId);
			}
			if (event.type === 'gameStarted') {
				setIsGameActive(true);
			}
		}

		console.log('Received agent events:', events);
	}, [events]);

	const handleStartGame = async () => {
		setIsStarting(true);
		try {
			await trpc.startStory.mutate({ roomId });
			toast('Game started successfully', Check);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to start game';
			toast(`Error: ${errorMessage}`, Check);
		} finally {
			setIsStarting(false);
		}
	};

	const handleCancelGame = async () => {
		setIsCanceling(true);
		try {
			await trpc.stopGame.mutate({ roomId });
			toast('Game cancelled successfully', Check);
			setIsGameActive(false);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to cancel game';
			toast(`Error: ${errorMessage}`, Check);
		} finally {
			setIsCanceling(false);
		}
	};

	return (
		<div className="flex flex-col py-6 gap-8">
			<section className="font-title text-2xl text-center">
				Deep Sea Stories
			</section>
			<section className="w-full grow flex flex-col gap-4">
				{!selectedStoryId ? (
					<Button
						size="large"
						className="w-full"
						onClick={() => setIsStoryPanelOpen(true)}
					>
						Choose a story
					</Button>
				) : isGameActive ? (
					<Button
						size="large"
						variant="outline"
						onClick={handleCancelGame}
						disabled={isCanceling}
					>
						{isCanceling ? 'Cancelling...' : 'Cancel the Game'}
					</Button>
				) : (
					<>
						<Button
							size="large"
							className="w-full"
							onClick={handleStartGame}
							disabled={isStarting}
						>
							{isStarting ? 'Starting...' : 'Start the Game'}
						</Button>
						<Button
							size="large"
							className="w-full"
							variant="outline"
							onClick={() => setIsStoryPanelOpen(true)}
						>
							Change the scenario
						</Button>
					</>
				)}
			</section>
			<section className="w-full flex-none flex flex-col gap-4">
				<HowToPlay className="w-full" />
				<HowItWorks className="w-full" />
				<CopyButton
					variant="outline"
					onCopy={() => toast('Gameroom link copied to clipboard', Check)}
					value={url}
				>
					{url.length > 40 ? `${url.substring(0, 37)}...` : url}
				</CopyButton>
			</section>
			<StorySelectionPanel
				isOpen={isStoryPanelOpen}
				onClose={() => setIsStoryPanelOpen(false)}
				roomId={roomId}
				userName={userName}
			/>
		</div>
	);
};

export default RoomControls;
