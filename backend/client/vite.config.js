import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/app-console/',
  plugins: [react()],
  resolve: { alias: { 'react-native': 'react-native-web' } },
  build: { outDir: 'build' },
  server: { proxy: { '/api': 'http://localhost:3101', '/call-function': 'http://localhost:3101' } },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./src/setupTests.js'] },
});
