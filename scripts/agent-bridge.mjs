// HTTP + JSON-lines + MCP bridge so an external agent can play without a screen.
//
//   node scripts/agent-bridge.mjs --port 8787 --seed 1
//   node scripts/agent-bridge.mjs --stdio
//   node scripts/agent-bridge.mjs --mcp
//
// Logs go to stderr. --stdio and --mcp reserve stdout for the protocol.
import { createServer } from 'node:http';
import { MANIFEST } from '../js/manifest.js';
import { gameUrl, launchBrowser, openGame, startStaticServer } from './session.mjs';

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1];
}
function has(name) { return process.argv.includes(name); }

const port = Number(arg('--port', '8787'));
const seedArg = arg('--seed', '1');
const useSeed = seedArg !== 'off' && seedArg !== 'none';
const stdio = has('--stdio');
const mcp = has('--mcp');
const noHttp = has('--no-http');
const log = (...parts) => console.error(...parts);

let page = null;

async function callGame(method, params) {
  if (!page) throw new Error('game page is not ready');
  return page.evaluate(async ({ method, params }) => {
    const g = window.game;
    if (method === 'getState') return g.getState();
    if (method === 'listActions') return g.listActions();
    if (method === 'manifest') return g.manifest;
    if (method === 'act') return g.act(params && params.action !== undefined ? params.action : params);
    if (method === 'step') {
      if (params && params.action != null) g.act(params.action);
      return g.step(params && params.n != null ? params.n : 1);
    }
    if (method === 'setSeed') return g.setSeed(params.seed, { restart: !!(params && params.restart) });
    if (method === 'runBot') {
      if (params && params.seed != null) g.setSeed(params.seed, { restart: true });
      const mod = await import('./js/bot.js');
      return mod.runBot(g, { levels: params?.levels ?? 1, maxTicks: params?.maxTicks ?? 7000 });
    }
    throw new Error('unknown method ' + method);
  }, { method, params });
}

const TOOL_METHOD = {
  get_state: 'getState',
  list_actions: 'listActions',
  act: 'act',
  step: 'step',
  set_seed: 'setSeed',
  run_bot: 'runBot',
  getState: 'getState',
  listActions: 'listActions',
  setSeed: 'setSeed',
  manifest: 'manifest',
  runBot: 'runBot'
};

async function dispatch(method, params = {}) {
  if (method === 'manifest') return MANIFEST;
  const mapped = TOOL_METHOD[method] || method;
  if (mapped === 'act') {
    const action = params && Object.prototype.hasOwnProperty.call(params, 'action') ? params.action : params;
    return callGame('act', { action });
  }
  return callGame(mapped, params);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 1_000_000) reject(new Error('body too large'));
      else chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) return resolve({});
      try { resolve(JSON.parse(text)); }
      catch { resolve(text); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  res.end(json);
}

async function handleHttp(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && (url.pathname === '/agent.json' || url.pathname === '/api/manifest')) {
      sendJson(res, 200, MANIFEST);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      sendJson(res, 200, await dispatch('getState'));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/actions') {
      sendJson(res, 200, await dispatch('listActions'));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/act') {
      const body = await readBody(req);
      const action = typeof body === 'string' ? body : (body.action !== undefined ? body.action : body);
      sendJson(res, 200, await dispatch('act', { action }));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/step') {
      sendJson(res, 200, await dispatch('step', await readBody(req)));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/seed') {
      sendJson(res, 200, await dispatch('setSeed', await readBody(req)));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/bot') {
      sendJson(res, 200, await dispatch('runBot', await readBody(req)));
      return;
    }
    sendJson(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: String(err && err.message || err) });
  }
}

function writeStdio(obj, mode) {
  const json = JSON.stringify(obj);
  if (mode === 'mcp') {
    const bytes = Buffer.byteLength(json);
    process.stdout.write(`Content-Length: ${bytes}\r\n\r\n${json}`);
  } else {
    process.stdout.write(json + '\n');
  }
}

async function handleRpc(msg, mode) {
  const respond = (payload) => {
    if (msg.id === undefined || msg.id === null) return;
    writeStdio(payload, mode);
  };
  try {
    if (mode === 'mcp' || msg.jsonrpc) {
      const method = msg.method;
      if (method === 'initialize') {
        respond({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            protocolVersion: msg.params?.protocolVersion || '2024-11-05',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'temple-of-the-z', version: '1.0.0' }
          }
        });
        return;
      }
      if (method === 'notifications/initialized' || method === 'notifications/cancelled') return;
      if (method === 'ping') {
        respond({ jsonrpc: '2.0', id: msg.id, result: {} });
        return;
      }
      if (method === 'tools/list') {
        respond({ jsonrpc: '2.0', id: msg.id, result: { tools: MANIFEST.tools } });
        return;
      }
      if (method === 'tools/call') {
        const name = msg.params?.name;
        const args = msg.params?.arguments || {};
        try {
          const result = await dispatch(name, args);
          const isError = !!(result && result.ok === false);
          respond({
            jsonrpc: '2.0',
            id: msg.id,
            result: { content: [{ type: 'text', text: JSON.stringify(result) }], isError }
          });
        } catch (err) {
          respond({
            jsonrpc: '2.0',
            id: msg.id,
            result: { content: [{ type: 'text', text: String(err.message || err) }], isError: true }
          });
        }
        return;
      }
      if (msg.id !== undefined) {
        respond({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'unknown method ' + method } });
      }
      return;
    }
    const result = await dispatch(msg.method, msg.params || {});
    respond({ id: msg.id ?? null, result });
  } catch (err) {
    if (msg.jsonrpc || mode === 'mcp') {
      respond({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32000, message: String(err.message || err) } });
    } else {
      respond({ id: msg.id ?? null, error: { message: String(err.message || err) } });
    }
  }
}

function readStdio(mode) {
  let buf = Buffer.alloc(0);
  const queue = [];
  let pumping = false;
  const pump = async () => {
    if (pumping) return;
    pumping = true;
    while (queue.length) {
      const item = queue.shift();
      await handleRpc(item.msg, item.mode);
    }
    pumping = false;
  };
  const push = (msg, msgMode) => { queue.push({ msg, mode: msgMode }); pump(); };
  process.stdin.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      while (buf.length && (buf[0] === 10 || buf[0] === 13 || buf[0] === 32 || buf[0] === 9)) buf = buf.slice(1);
      if (!buf.length) break;
      if (buf[0] === 0x7b) {
        const nl = buf.indexOf(0x0a);
        if (nl === -1) break;
        const line = buf.slice(0, nl).toString('utf8').trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try { push(JSON.parse(line), mode); }
        catch (err) { log('bad json line:', err.message); }
        continue;
      }
      const headerEnd = buf.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const header = buf.slice(0, headerEnd).toString('utf8');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) { log('bad stdio header'); buf = Buffer.alloc(0); break; }
      const len = Number(match[1]);
      const start = headerEnd + 4;
      if (buf.length < start + len) break;
      const body = buf.slice(start, start + len).toString('utf8');
      buf = buf.slice(start + len);
      try { push(JSON.parse(body), 'mcp'); }
      catch (err) { log('bad mcp body:', err.message); }
    }
  });
}

const files = await startStaticServer(0);
const browser = await launchBrowser();
page = await browser.newPage({ viewport: { width: 320, height: 240 } });
const url = gameUrl(files.origin, { agent: true, headless: true, seed: useSeed ? seedArg : null });
log('loading', url);
await openGame(page, url);
log('game ready', useSeed ? `(seed ${seedArg})` : '(unseeded)');

let apiServer = null;
if (!noHttp) {
  apiServer = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/') || url.pathname === '/agent.json') {
      handleHttp(req, res);
      return;
    }
    // Everything else is the game itself, so a browser can watch the same session
    // only through the Playwright page. Static files are served for /agent.json fetches
    // from the game origin separately. The API port is the agent port.
    handleHttp(req, res);
  });
  await new Promise((resolve, reject) => {
    apiServer.once('error', reject);
    apiServer.listen(port, '127.0.0.1', resolve);
  });
  const bound = apiServer.address().port;
  log(`agent API  http://127.0.0.1:${bound}`);
  log(`manifest    http://127.0.0.1:${bound}/agent.json`);
  log('GET /api/state    POST /api/act    POST /api/step    POST /api/bot');
}

if (stdio || mcp) readStdio(mcp ? 'mcp' : 'stdio');

async function shutdown() {
  log('shutting down');
  if (apiServer) await new Promise(resolve => apiServer.close(() => resolve()));
  await browser.close();
  await files.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
