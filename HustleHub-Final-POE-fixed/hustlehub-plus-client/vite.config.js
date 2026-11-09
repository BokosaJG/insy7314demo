import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The API uses a self-signed HTTPS certificate. Proxying /api through Vite means
// the browser only talks to http://localhost:5173, so no certificate warning
// and no CORS problems. Change API_TARGET if your API runs elsewhere.
const API_TARGET = process.env.API_TARGET || 'https://localhost:4000';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/main.jsx', 'src/setupTests.js'],
      reporter: ['text', 'text-summary', 'lcov'],
      thresholds: { statements: 80, lines: 80, functions: 70, branches: 70 },
    },
  },
  server: {
    port: 5173,
    strictPort: true, // the API only allows CLIENT_ORIGIN=http://localhost:5173
    proxy: {
      '/api': { target: API_TARGET, secure: false, changeOrigin: false },
    },
  },
});
