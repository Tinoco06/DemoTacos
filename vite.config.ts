import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// host: true permite abrir el prototipo desde la tablet en la misma red local.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: true, port: 5173 },
});
