// Builds the notifications consumption tests (real provider/hook, synthetic Supabase + auth)
// with esbuild and runs them with node:test. No network, no production data.
//   node scripts/test-consumption-notifications.mjs
// QA_NODE_MODULES may point at an existing node_modules (defaults to ./node_modules);
// QA_OUT_DIR sets where the bundle is written (defaults to the OS temp dir).
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const modules = path.resolve(process.env.QA_NODE_MODULES ?? path.join(repo, 'node_modules'))
if (!existsSync(path.join(modules, 'esbuild'))) throw new Error(`esbuild not found under ${modules}`)
const esbuild = createRequire(path.join(modules, 'noop.js'))('esbuild')
const fixtures = path.join(repo, 'scripts/tests/consumption-notifications')
const outDir = process.env.QA_OUT_DIR ? path.resolve(process.env.QA_OUT_DIR) : mkdtempSync(path.join(tmpdir(), 'consumption-notifications-'))
const outfile = path.join(outDir, 'notifications.test.mjs')

await esbuild.build({
    entryPoints: [path.join(fixtures, 'notifications.test.tsx')],
    bundle: true, platform: 'node', format: 'esm', target: 'node20', jsx: 'automatic',
    outfile, nodePaths: [modules], logLevel: 'warning',
    define: { 'process.env.NODE_ENV': '"development"' },
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    plugins: [{
        name: 'synthetic-boundaries',
        setup(build) {
            build.onResolve({ filter: /\/lib\/supabase$/ }, () => ({ path: path.join(fixtures, 'supabase.ts') }))
            build.onResolve({ filter: /\/AuthContext$/ }, () => ({ path: path.join(fixtures, 'auth.ts') }))
        },
    }],
})

// Hangs become failures: per-test timeout plus a hard process timeout.
const run = spawnSync(process.execPath, ['--test', '--test-timeout=5000', '--test-force-exit', '--test-reporter=spec', outfile], { stdio: 'inherit', timeout: 45000 })
if (run.error) console.error(run.error)
process.exit(run.status ?? 1)
