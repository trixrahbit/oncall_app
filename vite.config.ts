import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Optional convenience proxy in dev if you don't want to set CORS
        // '/api': {
        //   target: env.VITE_API_BASE || 'http://localhost:8000',
        //   changeOrigin: true,
        // }
      }
    },
    build: {
      outDir: 'dist',
    },
  };
});
