import { resolve } from 'path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // Use repository path in CI/CD, root path for local dev
  base: process.env.GITHUB_ACTIONS === 'true' ? '/arjs-marker-interactions/' : '/',
  plugins: [
    basicSsl()
  ],
  server: {
    host: true,
    port: 5173,
    https: true
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  }
});
