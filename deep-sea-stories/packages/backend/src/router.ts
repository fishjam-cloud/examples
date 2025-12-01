import { Notifications } from './controllers/notifications.js';
import { createPeer } from './controllers/peers.js';
import { createRoom, getRoom } from './controllers/rooms.js';
import {
	getStories,
	selectStory,
	startStory,
	stopGame,
} from './controllers/stories.js';
import { muteVoiceAgent } from './controllers/voice-agent.js';
import { router } from './trpc.js';

export const appRouter = router({
	createRoom,
	getRoom,
	createPeer,
	selectStory,
	startStory,
	stopGame,
	getStories,
	Notifications,
	muteVoiceAgent,
});

export type AppRouter = typeof appRouter;
