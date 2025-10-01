import { FishjamProvider } from '@fishjam-cloud/react-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { TRPCClientProvider } from './contexts/trpc.tsx';
import './index.css';

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
				<FishjamProvider fishjamId={import.meta.env.VITE_FISHJAM_ID}>
					<App />
				</FishjamProvider>
			</TRPCClientProvider>
		</QueryClientProvider>
	</StrictMode>,
);
