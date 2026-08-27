import { resolve } from 'path';
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: '/arjs-marker-interactions/',
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
        main: resolve(__dirname, 'index.html'),
        fu: resolve(__dirname, 'fu.html')
      }
    }
  }
});
