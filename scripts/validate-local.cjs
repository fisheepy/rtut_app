const { spawnSync } = require('node:child_process');
const path = require('node:path');
const npm = process.env.npm_execpath;
if (!npm) throw new Error('Run this script with npm run validate:local');
if (process.version !== 'v26.13.1') throw new Error(`Expected Node v26.13.1, got ${process.version}`);
for (const args of [
  ['test'],
  ['--prefix', 'backend/client', 'test'],
  ['--prefix', 'admin-web', 'run', 'build'],
  ['--prefix', 'backend/client', 'run', 'build'],
  ['run', 'test:smoke'],
]) {
  console.log(`\nValidating: npm ${args.join(' ')}`);
  const result = spawnSync(process.execPath, [npm, ...args], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) process.exit(result.status || 1);
}
