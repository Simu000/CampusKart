import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// In dev, /api calls are proxied to Spring Boot so there are no CORS headaches.
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': 'http://localhost:8081' } } });
