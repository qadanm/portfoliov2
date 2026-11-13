import {execFileSync} from 'node:child_process';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const version = (process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA ||
  execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'})).trim();
if (!/^[a-f0-9]{40}$/i.test(version)) throw new Error('Build version must be a Git commit SHA');

for (const path of [
  'index.html',
  'tools/cover-studio/index.html',
  'site.webmanifest',
  'tools/cover-studio/manifest.webmanifest',
]) {
  const file = new URL(path, `file://${dist}`);
  const html = await readFile(file, 'utf8');
  if (!html.includes('__BUILD_VERSION__')) throw new Error(`Missing version marker in ${path}`);
  await writeFile(file, html.replaceAll('__BUILD_VERSION__', version));
}
await writeFile(new URL('version.json', `file://${dist}`), JSON.stringify({version}));
console.log(`Stamped tools build ${version.slice(0, 12)}`);
