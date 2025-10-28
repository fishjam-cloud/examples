import { useState, useEffect } from 'react';
import type { AgentEvent } from '@deep-sea-stories/common';
import { useTRPCClient } from '@/contexts/trpc';

export const useAgentEvents = () => {
	const [events, setEvents] = useState<AgentEvent[]>([]);
	const trpcClient = useTRPCClient();

	useEffect(() => {
		const subscription = trpcClient.Notifications.subscribe(undefined, {
			onStarted: () => {
				console.log('[useAgentEvents] Subscription started successfully!');
			},
			onData: (data: unknown) => {
				const event = (data && typeof data === 'object' && 'data' in data)
					? (data as { data: AgentEvent }).data
					: data as AgentEvent;
				setEvents((prev) => [...prev, event]);
			},
			onError: (error: unknown) => {
				console.error('[useAgentEvents] Subscription error:', error);
			},
		});

		return () => {
			console.log('[useAgentEvents] Unsubscribing...');
			subscription.unsubscribe();
		};
	}, [trpcClient]);

	return events;
};
