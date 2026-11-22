// Starts only a local, isolated server. Never uses production credentials.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes, createHmac } = require('node:crypto');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const path = require('node:path');

async function main() {
  const secret = randomBytes(32).toString('hex');
  const child = spawn(process.execPath, ['backend/server/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP,
      APP_ENV: 'test', NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '0',
      MONGODB_DATABASE: 'rtut_staging_smoke', MONGODB_URI: 'mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=150',
      ADMIN_SESSION_SECRET: secret, ADMIN_API_KEY: randomBytes(32).toString('hex') },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  try {
    let port;
    for (let attempt = 0; attempt < 100; attempt++) {
      port = output.match(/Server is running on port (\d+)/)?.[1];
      if (port) break;
      if (child.exitCode !== null) throw new Error(`Server exited: ${output}`);
      await delay(100);
    }
    assert.ok(port, `Server did not start: ${output}`);
    const base = `http://127.0.0.1:${port}`;
    const request = (route, options = {}) => fetch(base + route, { redirect: 'manual', signal: AbortSignal.timeout(5000), ...options });
    const health = await (await request('/api/health')).json();
    assert.equal(health.environment, 'test');
    assert.equal(health.node, process.version);
    assert.equal(health.ok, true);
    console.log('PASS isolated server boot and health');

    for (const route of ['/api/admin-auth/me', '/employees', '/api/training-auth/me']) {
      assert.equal((await request(route)).status, 401, route);
    }
    const canonical = await request('/app-console');
    assert.equal(canonical.status, 301);
    const blocked = await request('/app-console/');
    assert.equal(blocked.status, 302);
    assert.equal(blocked.headers.get('location'), '/admin');
    assert.equal((await request('/admin/digest', { method: 'POST' })).status, 401);
    console.log('PASS unauthenticated route protection');

    const now = Date.now();
    const payload = Buffer.from(JSON.stringify({ firstName: 'Local', lastName: 'Tester', email: 'test@example.test', type: 'admin', iat: now, exp: now + 60000 })).toString('base64url');
    const cookie = `rtut_admin_session=${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`;
    const headers = { cookie };
    assert.equal((await request('/api/admin-auth/me', { headers })).status, 200);
    for (const route of ['/admin/', '/admin/payroll-verification', '/hr-tools/', '/hr-tools/hr-platform/new-hire', '/app-console/', '/app-console/deep-link']) {
      const response = await request(route, { headers });
      assert.equal(response.status, 200, route);
      const html = await response.text();
      assert.match(html, /<div id="root"><\/div>/, route);
      const assets = [...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(match => match[1]);
      assert.ok(assets.length, `${route}: no built assets`);
      for (const asset of assets) {
        const result = await request(asset, { headers });
        assert.equal(result.status, 200, asset);
        assert.doesNotMatch(result.headers.get('content-type') || '', /text\/html/, asset);
      }
    }
    console.log('PASS both built frontends, deep links and asset URLs');
    assert.equal((await request('/api/not-a-real-route')).status, 404);
    assert.doesNotMatch(output, /reconciliation complete|Connected to MongoDB|daily.*sent/i);
    console.log('PASS no startup database reconciliation or scheduled delivery');
  } finally {
    if (child.exitCode === null) { child.kill(); await once(child, 'exit'); }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
