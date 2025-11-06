import { httpToWsUrl } from '@/lib/utils';
import type { QueryClient } from '@tanstack/react-query';
import {
	createTRPCClient,
	createWSClient,
	httpBatchLink,
	splitLink,
	wsLink,
} from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from 'backend';
import { type FC, type PropsWithChildren, useState } from 'react';

export const { TRPCProvider, useTRPC, useTRPCClient } =
	createTRPCContext<AppRouter>();

interface TRPCClientProviderProps extends PropsWithChildren {
	queryClient: QueryClient;
}

const wsClient = createWSClient({
	url: httpToWsUrl(import.meta.env.VITE_BACKEND_URL),
	onOpen: () => {
		console.log('[tRPC] WebSocket connection opened');
	},
	onClose: (cause) => {
		console.log('[tRPC] WebSocket connection closed:', cause);
	},
});

export const TRPCClientProvider: FC<TRPCClientProviderProps> = ({
	queryClient,
	children,
}) => {
	if (!import.meta.env.VITE_BACKEND_URL) {
		throw new Error('VITE_BACKEND_URL is not set');
	}
	const [trpcClient] = useState(() =>
		createTRPCClient<AppRouter>({
			links: [
				splitLink({
					condition(op) {
						return op.type === 'subscription';
					},
					true: wsLink({
						client: wsClient,
					}),
					false: httpBatchLink({
						url: import.meta.env.VITE_BACKEND_URL,
					}),
				}),
			],
		}),
	);

	return (
		<TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
			{children}
		</TRPCProvider>
	);
};
