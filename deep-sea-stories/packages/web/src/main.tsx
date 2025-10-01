import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.tsx';
import { TRPCClientProvider } from './contexts/trpc.tsx';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retryDelay: 2000,
		},
	},
});

// biome-ignore lint/style/noNonNullAssertion: root always exists
createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<QueryClientProvider client={queryClient}>
			<TRPCClientProvider queryClient={queryClient}>
				<App />
			</TRPCClientProvider>
		</QueryClientProvider>
	</StrictMode>,
);
