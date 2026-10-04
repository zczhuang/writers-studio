import { readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const sources = [
  ...readdirSync(join(root, 'scripts')).filter((name) => name.endsWith('.test.mjs')).map((name) => join(root, 'scripts', name)),
  ...readdirSync(join(root, 'tests')).filter((name) => name.endsWith('.test.mjs')).map((name) => join(root, 'tests', name)),
];
const outputDir = mkdtempSync(join(tmpdir(), 'writers-studio-tests-'));

try {
  const bundles = [];
  for (const source of sources) {
    const output = join(outputDir, basename(source));
    const bundled = spawnSync(
      join(root, 'node_modules', '.bin', 'rolldown'),
      [source, '--platform', 'node', '--format', 'esm', '--file', output],
      { cwd: root, encoding: 'utf8' },
    );
    if (bundled.stdout) process.stdout.write(bundled.stdout);
    if (bundled.stderr) process.stderr.write(bundled.stderr);
    if (bundled.status !== 0) process.exit(bundled.status ?? 1);
    bundles.push(output);
  }
  const tested = spawnSync(process.execPath, ['--test', ...bundles], {
    cwd: root,
    env: { ...process.env, TZ: 'America/New_York' },
    stdio: 'inherit',
  });
  process.exitCode = tested.status ?? 1;
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
