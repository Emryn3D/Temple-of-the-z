// Shared headless-Chrome session for the agent checks, the reference bot, and the bridge.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

export function startStaticServer(port = 0) {
  const server = createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const full = resolve(root, '.' + pathname);
      const base = resolve(root);
      if (full !== base && !full.startsWith(base + '/')) {
        res.writeHead(403); res.end('forbidden'); return;
      }
      if (pathname === '/favicon.ico') {
        res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
        res.end();
        return;
      }
      if (!existsSync(full) || !statSync(full).isFile()) {
        console.error('404', pathname);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end('not found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME[extname(full)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(readFileSync(full));
    } catch (err) {
      res.writeHead(500); res.end(String(err && err.message || err));
    }
  });
  return new Promise((resolveListen, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const bound = server.address().port;
      resolveListen({
        server,
        port: bound,
        origin: `http://127.0.0.1:${bound}`,
        close: () => new Promise(done => server.close(() => done()))
      });
    });
  });
}

export function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  throw new Error('Chrome not found. Set CHROME_PATH to a Chromium or Chrome binary.');
}

export const CHROME_ARGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding'
];

export async function launchBrowser() {
  return chromium.launch({
    executablePath: chromePath(),
    headless: true,
    args: CHROME_ARGS
  });
}

export function gameUrl(origin, { agent = false, headless = false, seed = null, bot = false, levels = null, maxTicks = null } = {}) {
  const q = new URLSearchParams();
  if (agent) q.set('agent', '1');
  if (headless) q.set('headless', '1');
  if (bot) q.set('bot', '1');
  if (seed != null) q.set('seed', String(seed));
  if (levels != null) q.set('levels', String(levels));
  if (maxTicks != null) q.set('maxTicks', String(maxTicks));
  const s = q.toString();
  return `${origin}/${s ? '?' + s : ''}`;
}

export function watchPage(page) {
  page.on('pageerror', err => console.error('PAGEERROR', err.message));
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') console.error('PAGE error:', text);
    else if (text.startsWith('bot ') || text.startsWith('BOT_')) console.error(text);
  });
}

export async function openGame(page, url) {
  watchPage(page);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.game && window.game.ready, null, { timeout: 60000 });
  const loadError = await page.evaluate(async () => {
    await window.game.ready;
    return window.game.getState().loadError || null;
  });
  if (loadError) throw new Error('game failed to load: ' + loadError);
}
