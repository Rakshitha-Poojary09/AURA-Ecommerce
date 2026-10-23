import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for dedicated AURA Admin Frontend running on port 5174
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    host: true,
    proxy: {
      '/products': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
