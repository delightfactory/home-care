import path from 'node:path'
import base from '../../../vite.config'
export default { ...base, plugins: [...base.plugins, { name: 'isolated-extension-fixture', enforce: 'pre', resolveId(source: string) {
  if (source.endsWith('/api/routes') || source.endsWith('/api/lifecycle')) return path.resolve(__dirname, 'api.ts')
} }], optimizeDeps: { entries: ['scripts/tests/route-extension-ui/index.html'] }, server: { host: '127.0.0.1', port: 6195, strictPort: true } }
