import { build } from 'esbuild';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const baselineControl = process.argv.includes('--baseline-control');
if (!process.env.QA_OUT_DIR) throw Error('QA_OUT_DIR must be an external verification directory');
mkdirSync(process.env.QA_OUT_DIR, { recursive: true });
const outfile = path.join(process.env.QA_OUT_DIR, 'request-consumption.test.mjs');
await build({
  entryPoints: [path.join(root, 'scripts/tests/request-consumption/readers.test.ts')],
  bundle: true, platform: 'node', format: 'esm', outfile,
  define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: 'https://auth-test.invalid', VITE_SUPABASE_ANON_KEY: 'synthetic-public-key' }) },
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); globalThis.window = new EventTarget(); globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' }); globalThis.__qaIntervals = []; const __setInterval = globalThis.setInterval; globalThis.setInterval = (...args) => { const timer = __setInterval(...args); globalThis.__qaIntervals.push(timer); return timer; };" },
  plugins: [{ name: 'http-boundary', setup(builder) {
    builder.onResolve({ filter: /\/lib\/supabase$/ }, args => ({ path: path.join(root,
      args.importer.endsWith('readers.test.ts') ? 'src/lib/supabase.ts' : 'scripts/tests/request-consumption/supabase.ts') }));
    builder.onResolve({ filter: /^@supabase\/supabase-js$/ }, args => {
      if (args.importer.replaceAll('\\', '/').endsWith('/src/lib/supabase.ts')) return { path: path.join(root, 'scripts/tests/request-consumption/auth-sdk.ts') };
    });
    if (baselineControl) builder.onLoad({ filter: /[\\/]src[\\/]api[\\/]enhanced-api\.ts$/ }, () => ({
      contents: execFileSync('git', ['show', 'HEAD:src/api/enhanced-api.ts'], { cwd: root, encoding: 'utf8' }),
      loader: 'ts', resolveDir: path.join(root, 'src/api'),
    }));
  } }],
});
const run = spawnSync(process.execPath, ['--test', '--test-timeout=5000', ...(baselineControl ? ['--test-name-pattern=^orders: eight'] : []), outfile], { encoding: 'utf8', timeout: 30000 });
if (run.error) throw run.error;
process.stdout.write(run.stdout ?? '');
process.stderr.write(run.stderr ?? '');
if (baselineControl) {
  if (run.status !== 1 || !run.stdout.includes('8 !== 1')) throw Error('Baseline did not demonstrate duplicate HTTP reads');
  console.log('PASS baseline control: original orders reader sends eight HTTP reads instead of one');
  process.exit(0);
}
process.exit(run.status ?? 1);
