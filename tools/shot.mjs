// Headless screenshot helper.
//   node tools/shot.mjs "<path?query>" out.png [width] [height] [waitMs] [--full] [--eval "js"]
// Serves the repo root on a random port, opens the page in Chromium,
// waits for window.__ready (or waitMs) and writes a PNG. Console errors
// are printed so broken modules are obvious.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--') && a !== '--eval'));
const evalIdx = args.indexOf('--eval');
const evalJs = evalIdx >= 0 ? args[evalIdx + 1] : null;
const pos = args.filter((a, i) => !a.startsWith('--') && (evalIdx < 0 || i !== evalIdx + 1));
const [page = 'index.html', out = 'shot.png', w = '1400', h = '900', wait = '8000'] = pos;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(root, u);
  if (!f.startsWith(root)) return res.writeHead(403).end();
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (e, data) => {
    if (e) return res.writeHead(404).end('not found');
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const pg = await ctx.newPage();
pg.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning' || flags.has('--log')) console.log(`[${m.type()}]`, m.text());
});
pg.on('pageerror', (e) => console.log('[pageerror]', e.stack || e.message));
await pg.goto(`http://127.0.0.1:${port}/${page.replace(/^\//, '')}`);
const t0 = Date.now();
while (Date.now() - t0 < +wait) {
  const ready = await pg.evaluate(() => window.__ready === true).catch(() => false);
  if (ready) break;
  await new Promise((r) => setTimeout(r, 200));
}
if (evalJs) {
  const r = await pg.evaluate(evalJs);
  if (r !== undefined) console.log('eval:', typeof r === 'string' ? r : JSON.stringify(r));
  await new Promise((r) => setTimeout(r, +(process.env.AFTER_EVAL_MS || 500)));
}
await pg.screenshot({ path: out, fullPage: flags.has('--full') });
console.log('saved', out, `(${Date.now() - t0}ms)`);
await browser.close();
server.close();
