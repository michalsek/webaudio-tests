import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
  // @ts-expect-error
  base: process.env.BASE_URL || '/',
  plugins: [react()],
});
