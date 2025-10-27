import { publicProcedure } from '../trpc.js';
import { notifierService } from '../service/notifier.js';
import type { AgentEvent } from '@deep-sea-stories/common';
import { tracked } from '@trpc/server';
import { on } from 'node:events';
import { z } from 'zod';

export const Notifications = publicProcedure
	.input(
		z
			.object({
				lastEventId: z.string().nullish(),
			})
			.optional(),
	)
	.subscription(async function* (opts) {
		const lastEventId = opts.input?.lastEventId
			? parseInt(opts.input.lastEventId, 10)
			: undefined;


		const history = notifierService.getEventHistory(lastEventId);
		console.log(`Replaying ${history.length} events from history`);
		for (const { id, event } of history) {
			yield tracked(id.toString(), event as AgentEvent);
		}

		
		for await (const [event, eventId] of on(notifierService, 'notification', {
			signal: opts.signal,
		})) {
			yield tracked(eventId.toString(), event as AgentEvent);
		}
		
	});
