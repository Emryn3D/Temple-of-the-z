// Starts the bridge and drives one observe/act/step cycle over HTTP, then one MCP call.
import { spawn } from 'node:child_process';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const port = 8799;
const child = spawn(process.execPath, ['scripts/agent-bridge.mjs', '--port', String(port), '--seed', '4', '--mcp'], {
  stdio: ['pipe', 'pipe', 'pipe']
});
let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk.toString(); process.stderr.write(chunk); });

const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('bridge did not become ready\n' + stderr)), 60000);
  child.stderr.on('data', () => {
    if (stderr.includes('agent API')) {
      clearTimeout(timer);
      resolve();
    }
  });
  child.on('exit', code => {
    clearTimeout(timer);
    reject(new Error('bridge exited early: ' + code + '\n' + stderr));
  });
});

function sendMcp(obj) {
  const json = JSON.stringify(obj);
  const bytes = Buffer.byteLength(json);
  child.stdin.write(`Content-Length: ${bytes}\r\n\r\n${json}`);
}

function readMcp(stream) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const timer = setTimeout(() => reject(new Error('mcp timeout')), 20000);
    const onData = chunk => {
      buf = Buffer.concat([buf, chunk]);
      const headerEnd = buf.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = buf.slice(0, headerEnd).toString('utf8');
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) return;
      const len = Number(match[1]);
      const start = headerEnd + 4;
      if (buf.length < start + len) return;
      clearTimeout(timer);
      stream.off('data', onData);
      resolve(JSON.parse(buf.slice(start, start + len).toString('utf8')));
    };
    stream.on('data', onData);
  });
}

try {
  await ready;
  const base = `http://127.0.0.1:${port}`;
  const manifest = await (await fetch(base + '/agent.json')).json();
  assert(manifest.name === 'temple-of-the-z', 'manifest name');
  assert(Array.isArray(manifest.tools) && manifest.tools.some(t => t.name === 'step'), 'manifest tools');

  const health = await (await fetch(base + '/api/health')).json();
  assert(health.ok === true, 'health');

  const started = await (await fetch(base + '/api/act', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'start' })
  })).json();
  assert(started.ok === true, 'start via HTTP');

  const stepped = await (await fetch(base + '/api/step', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ n: 15, action: { forward: 1, strafe: 0, turn: 0 } })
  })).json();
  assert(stepped.status === 'run', 'step should be running');
  assert(stepped.player.z < -1, 'HTTP step should walk toward -Z, z=' + stepped.player?.z);
  assert(stepped.seed === '4', 'bridge seed should be visible');
  console.log(`bridge http ok  z=${stepped.player.z} level=${stepped.level.name}`);

  const listed = readMcp(child.stdout);
  sendMcp({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const tools = await listed;
  assert(tools.result?.tools?.some(t => t.name === 'get_state'), 'mcp tools/list');

  const called = readMcp(child.stdout);
  sendMcp({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'get_state', arguments: {} } });
  const stateMsg = await called;
  const text = stateMsg.result?.content?.[0]?.text;
  const obs = JSON.parse(text);
  assert(obs.player.z < -1, 'mcp get_state should see the same session');
  console.log('bridge mcp ok');
  console.log('bridge check passed');
} finally {
  child.kill('SIGTERM');
  await new Promise(resolve => child.on('exit', resolve));
}
