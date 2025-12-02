import { on } from 'node:events';
import type { AgentEvent } from '@deep-sea-stories/common';
import { tracked } from '@trpc/server';
import { z } from 'zod';
import { publicProcedure } from '../trpc.js';

export const Notifications = publicProcedure
	.input(
		z.object({
			lastEventId: z.string().nullish(),
			roomId: z.string(),
		}),
	)
	.subscription(async function* (opts) {
		const lastEventId = opts.input?.lastEventId
			? parseInt(opts.input.lastEventId, 10)
			: undefined;

		const roomId = opts.input.roomId;
		const history = opts.ctx.notifierService.getEventHistory(
			roomId,
			lastEventId,
		);
		console.log(`Replaying ${history.length} events from history`);
		for (const { id, event } of history) {
			yield tracked(id.toString(), event as AgentEvent);
		}

		for await (const [emittedRoomId, event, eventId] of on(
			opts.ctx.notifierService,
			'notification',
			{
				signal: opts.signal,
			},
		)) {
			if (emittedRoomId !== roomId) continue;
			yield tracked(eventId.toString(), event as AgentEvent);
		}
	});
