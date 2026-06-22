import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
 const env = loadEnv(mode, process.cwd(), '');
  if (!env.VITE_MOQ_URL) {
    throw new Error(
      'VITE_MOQ_URL is not set — provide the MoQ relay URL in a .env file (see .env.example).',
    );
  }

  return {
    plugins: [react()],
    server: {
      allowedHosts: true,
      port: 5170,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
