const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
function tests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = join(dir, entry.name);
    return entry.isDirectory() ? tests(file) : /\.test\.(js|mjs)$/.test(file) ? [file] : [];
  });
}
const result = spawnSync(process.execPath, ['--test', ...tests('backend/server')], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
