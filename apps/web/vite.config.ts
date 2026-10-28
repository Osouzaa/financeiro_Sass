import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    // Em dev, o front chama /api no mesmo endereço e o Vite repassa para o NestJS.
    // Assim o cookie de refresh funciona sem configuração extra de CORS.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
