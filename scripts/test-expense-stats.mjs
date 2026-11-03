import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
if (!process.env.QA_OUT_DIR) throw Error('QA_OUT_DIR must be an external verification directory');
mkdirSync(process.env.QA_OUT_DIR, { recursive: true });
const outfile = path.join(process.env.QA_OUT_DIR, 'expense-stats.test.mjs');
await build({
  entryPoints: [path.join(root, 'scripts/tests/expense-stats.test.tsx')],
  bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', outfile,
  define: { 'process.env.NODE_ENV': '"development"' },
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); globalThis.window = new EventTarget(); globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible', activeElement: null }); window.document = document; window.HTMLIFrameElement = class {}; globalThis.IS_REACT_ACT_ENVIRONMENT = true; globalThis.__qaChannels = []; const __MessageChannel = globalThis.MessageChannel; globalThis.MessageChannel = class extends __MessageChannel { constructor() { super(); globalThis.__qaChannels.push(this); } }; globalThis.__qaIntervals = []; const __setInterval = globalThis.setInterval; globalThis.setInterval = (...args) => { const timer = __setInterval(...args); globalThis.__qaIntervals.push(timer); return timer; };" },
  plugins: [{ name: 'synthetic-http-boundary', setup(builder) {
    builder.onResolve({ filter: /\/lib\/supabase$/ }, () => ({ path: path.join(root, 'scripts/tests/expense-stats-supabase.ts') }));
    builder.onResolve({ filter: /\/hooks\/useEnhancedAPI$/ }, args => {
      if (args.importer.replaceAll('\\', '/').endsWith('/Expenses/ExpensesPage.tsx')) return { path: path.join(root, 'scripts/tests/expense-stats-page-boundary.tsx') };
    });
    builder.onResolve({ filter: /\/(?:contexts\/AuthContext|hooks\/usePermissions)$/ }, () => ({ path: path.join(root, 'scripts/tests/expense-stats-page-boundary.tsx') }));
    builder.onResolve({ filter: /^react-hot-toast$/ }, () => ({ path: path.join(root, 'scripts/tests/expense-stats-toast.ts') }));
  } }],
});
const run = spawnSync(process.execPath, ['--test', '--test-timeout=5000', outfile], { stdio: 'inherit', timeout: 30000 });
if (run.error) throw run.error;
process.exit(run.status ?? 1);
