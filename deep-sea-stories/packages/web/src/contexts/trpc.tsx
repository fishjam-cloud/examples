import type { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from '@trpc/tanstack-react-query';
import type { AppRouter } from 'backend';
import { type FC, type PropsWithChildren, useState } from 'react';

export const { TRPCProvider, useTRPC, useTRPCClient } =
	createTRPCContext<AppRouter>();

interface TRPCClientProviderProps extends PropsWithChildren {
	queryClient: QueryClient;
}

export const TRPCClientProvider: FC<TRPCClientProviderProps> = ({
	queryClient,
	children,
}) => {
	const [trpcClient] = useState(() =>
		createTRPCClient<AppRouter>({
			links: [
				httpBatchLink({
					url: import.meta.env.VITE_BACKEND_URL,
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
