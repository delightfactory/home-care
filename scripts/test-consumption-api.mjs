import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outfile = path.join(process.env.QA_OUT_DIR ?? mkdtempSync(path.join(tmpdir(), 'homecare-consumption-')), process.argv.includes('--auth') ? 'auth-scope.test.mjs' : 'counts-api.test.mjs');
await build({
  entryPoints: [path.join(root, process.argv.includes('--auth') ? 'scripts/tests/consumption-api/auth.test.tsx' : 'scripts/tests/consumption-api/counts.test.ts')],
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', outfile,
  define: { 'process.env.NODE_ENV': '"development"' },
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); globalThis.window = new EventTarget();" },
  plugins: [{ name: 'supabase-boundary', setup(builder) {
    builder.onResolve({ filter: /\/lib\/supabase$/ }, () => ({ path: path.join(root, process.argv.includes('--auth') ? 'scripts/tests/consumption-api/auth-supabase.ts' : 'scripts/tests/consumption-api/supabase.ts') }));
  } }],
});
const execution = spawnSync(process.execPath, ['--test', '--test-timeout=5000', ...(process.argv.includes('--auth') ? ['--test-force-exit'] : []), outfile], { stdio: 'inherit', timeout: 15000 });
if (execution.error) console.error(execution.error);
process.exit(execution.status ?? 1);
