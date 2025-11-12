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
import { DeepSeaLogo } from './DeepSeaLogo';

export type RoomControlsProps = {
	roomId: string;
	userName: string;
};

const RoomControls: FC<RoomControlsProps> = ({ roomId, userName }) => {
	const url = `https://deepsea.fishjam.io/${roomId}`;
	const [isStoryPanelOpen, setIsStoryPanelOpen] = useState(false);
	const [isCanceling, setIsCanceling] = useState(false);
	const [isStarting, setIsStarting] = useState(false);
	const trpc = useTRPCClient();
	const events = useAgentEvents(roomId);

	const reversedEvents = [...events].reverse();
	const lastGameEndedIndex = reversedEvents.findIndex(
		(event) => event.type === 'gameEnded',
	);
	const startIndex = (events.length - 1 - lastGameEndedIndex) % events.length;
	const currentGameEvents = events.slice(startIndex);
	const isStorySelected = currentGameEvents.some(
		(event) => event.type === 'storySelected',
	);
	const isGameActive = currentGameEvents.some(
		(event) => event.type === 'gameStarted',
	);

	useEffect(() => {
		void trpc.getStories.query();
	}, [trpc]);

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
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Failed to cancel game';
			toast(`Error: ${errorMessage}`, Check);
		} finally {
			setIsCanceling(false);
		}
	};

	return (
		<div className="flex flex-col py-2 md:py-4 lg:py-6 gap-2 md:gap-4 lg:gap-6">
			<DeepSeaLogo className="hidden md:block" />
			<section className="w-full flex-none grid grid-cols-2 md:flex md:flex-col gap-2 md:gap-3">
				{!isStorySelected ? (
					<Button
						size="large"
						className="col-span-2 md:w-full text-xs md:text-base h-9 md:h-12 lg:h-14"
						onClick={() => setIsStoryPanelOpen(true)}
					>
						Choose a story
					</Button>
				) : isGameActive ? (
					<Button
						size="large"
						variant="outline"
						className="col-span-2 md:w-full text-xs md:text-base h-9 md:h-12 lg:h-14"
						onClick={handleCancelGame}
						disabled={isCanceling}
					>
						{isCanceling ? 'Cancelling...' : 'Cancel the Game'}
					</Button>
				) : (
					<>
						<Button
							className="col-span-2 md:w-full text-xs md:text-base h-9 md:h-10 lg:h-11"
							onClick={handleStartGame}
							disabled={isStarting}
						>
							{isStarting ? 'Starting...' : 'Start the Game'}
						</Button>
						<Button
							className="col-span-2 md:w-full text-xs md:text-base h-9 md:h-10 lg:h-11"
							variant="outline"
							onClick={() => setIsStoryPanelOpen(true)}
						>
							Change the scenario
						</Button>
					</>
				)}
			</section>
			<section className="w-full flex-none flex flex-col gap-2 md:gap-3">
				<HowToPlay className="w-full text-xs md:text-base h-9 md:h-10 lg:h-11" />
				<HowItWorks className="w-full text-xs md:text-base h-9 md:h-10 lg:h-11" />

				<CopyButton
					variant="outline"
					className="col-span-2 md:col-span-1 text-xs md:text-base h-9 md:h-10 lg:h-11"
					onCopy={() => toast('Gameroom link copied to clipboard', Check)}
					value={url}
				>
					Copy room link
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
