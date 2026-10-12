import path from 'node:path'
import fs from 'node:fs'
import base from '../../../vite.config'
export default { ...base, plugins: [...base.plugins, { name: 'isolated-tech-fixtures', enforce: 'pre', transform(_code: string, id: string) {
    if (process.env.QA_BASELINE_HOOK && id.replaceAll('\\', '/').endsWith('/src/hooks/useTechnicianData.ts')) return fs.readFileSync(process.env.QA_BASELINE_HOOK, 'utf8')
}, resolveId(source: string) {
    for (const [suffix, file] of [['/contexts/AuthContext', 'auth.ts'], ['/lib/supabase', 'supabase.ts'], ['/Layout/TechLayout', 'layout.tsx']]) {
        if (source.endsWith(suffix)) return path.resolve(__dirname, file)
    }
} }], optimizeDeps: { entries: ['scripts/tests/tech-proof-focus/index.html'] }, server: { host: '127.0.0.1', port: 6193, strictPort: true } }
