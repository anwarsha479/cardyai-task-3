import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The single .env lives in the task folder, shared with the backend and docker-compose.
const envDir = '..';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, '');
  const port = Number(env.FRONTEND_PORT);
  if (!port) {
    throw new Error('FRONTEND_PORT is missing from the root .env file');
  }
  return {
    envDir,
    plugins: [react()],
    server: { port, strictPort: true },
    preview: { port, strictPort: true },
  };
});
