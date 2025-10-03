import { createRoom, getRoom } from './controllers/rooms.js';
import { createPeer } from './controllers/peers.js';
import { router } from './trpc.js';

export const appRouter = router({
	createRoom,
	getRoom,
	createPeer,
});

export type AppRouter = typeof appRouter;
