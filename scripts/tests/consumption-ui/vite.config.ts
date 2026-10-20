import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), { name: 'synthetic-consumption-boundaries', enforce: 'pre', resolveId(source) {
    if (source.endsWith('/lib/supabase')) return path.resolve(__dirname, 'supabase.ts');
    if (source.endsWith('/AuthContext')) return path.resolve(__dirname, '../consumption-notifications/auth.ts');
  } }],
  optimizeDeps: { entries: ['scripts/tests/consumption-ui/index.html'] },
  server: { host: '127.0.0.1', port: 6197, strictPort: true },
  build: { outDir: path.resolve(__dirname, '../../../../consumption-ui-build') },
});
