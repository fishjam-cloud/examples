import type { AgentEvent } from '@deep-sea-stories/common';
import { useEffect, useState } from 'react';
import { useTRPCClient } from '@/contexts/trpc';

export const useAgentEvents = (roomId?: string) => {
	const [events, setEvents] = useState<AgentEvent[]>([]);
	const trpcClient = useTRPCClient();

	useEffect(() => {
		if (!roomId) return;

		setEvents([]);

		const subscription = trpcClient.Notifications.subscribe(
			{ roomId, lastEventId: undefined },
			{
				onStarted: () => {
					console.log(
						'[useAgentEvents] Subscription started successfully for',
						roomId,
					);
				},
				onData: (data: unknown) => {
					const event =
						data && typeof data === 'object' && 'data' in data
							? (data as { data: AgentEvent }).data
							: (data as AgentEvent);
					setEvents((prev) => [...prev, event]);
				},
				onError: (error: unknown) => {
					console.error('[useAgentEvents] Subscription error:', error);
				},
			},
		);

		return () => {
			console.log('[useAgentEvents] Unsubscribing from', roomId);
			subscription.unsubscribe();
		};
	}, [trpcClient, roomId]);

	return events;
};
