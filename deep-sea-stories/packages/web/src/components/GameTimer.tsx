import { GAME_TIME_LIMIT_SECONDS } from '@deep-sea-stories/common';
import { Clock } from 'lucide-react';
import { type FC, useEffect, useState } from 'react';
import { useAgentEvents } from '@/hooks/useAgentEvents';

type GameTimerProps = {
	roomId: string;
};

const formatDuration = (seconds: number): string => {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}
	return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const GameTimer: FC<GameTimerProps> = ({ roomId }) => {
	const events = useAgentEvents(roomId);
	const [gameStartTime, setGameStartTime] = useState<number | null>(null);
	const [remainingTime, setRemainingTime] = useState(GAME_TIME_LIMIT_SECONDS);

	useEffect(() => {
		const reversedEvents = [...events].reverse();
		const lastGameEndedIndex = reversedEvents.findIndex(
			(event) => event.type === 'gameEnded',
		);

		if (lastGameEndedIndex !== -1) {
			const startIndex = events.length - lastGameEndedIndex;
			const currentGameEvents = events.slice(startIndex);
			const gameStartEvent = currentGameEvents.find(
				(event) => event.type === 'gameStarted',
			);

			if (!gameStartEvent) {
				setGameStartTime(null);
				setRemainingTime(GAME_TIME_LIMIT_SECONDS);
				return;
			}
		}

		const startIndex =
			lastGameEndedIndex === -1 ? 0 : events.length - lastGameEndedIndex;
		const currentGameEvents = events.slice(startIndex);
		const gameStartEvent = currentGameEvents.find(
			(event) => event.type === 'gameStarted',
		);

		if (gameStartEvent && !gameStartTime) {
			setGameStartTime(gameStartEvent.timestamp);
		}
	}, [events, gameStartTime]);

	useEffect(() => {
		if (!gameStartTime) return;

		const interval = setInterval(() => {
			const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
			const remaining = Math.max(GAME_TIME_LIMIT_SECONDS - elapsed, 0);
			setRemainingTime(remaining);
		}, 1000);

		return () => clearInterval(interval);
	}, [gameStartTime]);

	if (!gameStartTime) return null;

	return (
		<div className="flex items-center justify-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-4xl font-medium w-fit self-center">
			<Clock size={18} />
			<span className="text-base font-mono">
				{formatDuration(remainingTime)}
			</span>
		</div>
	);
};

export default GameTimer;
