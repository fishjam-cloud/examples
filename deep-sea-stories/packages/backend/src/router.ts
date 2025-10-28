import { createRoom, getRoom } from './controllers/rooms.js';
import { createPeer } from './controllers/peers.js';
import { startStory, getStories } from './controllers/stories.js';
import { Notifications } from './controllers/notifications.js';
import { router } from './trpc.js';

export const appRouter = router({
	createRoom,
	getRoom,
	createPeer,
	startStory,
	getStories,
	Notifications,
});

export type AppRouter = typeof appRouter;
