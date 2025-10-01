import { createRoom, getRoom } from './controllers/rooms.js';
import { router } from './trpc.js';

export const appRouter = router({
	createRoom,
	getRoom,
});

export type AppRouter = typeof appRouter;
