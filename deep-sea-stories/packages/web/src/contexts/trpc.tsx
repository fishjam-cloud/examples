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

globalThis.WebSocket = WebSocket as any;

const wsClient = createWSClient({
	url: import.meta.env.VITE_BACKEND_WS_URL,
});

export const TRPCClientProvider: FC<TRPCClientProviderProps> = ({
	queryClient,
	children,
}) => {
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
