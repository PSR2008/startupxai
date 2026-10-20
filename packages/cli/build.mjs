import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
const root = new URL('./', import.meta.url);
await mkdir(new URL('dist/analyzer/', root), { recursive: true });
for (const name of ['ingestion', 'engine', 'runner', 'worker']) {
  await copyFile(new URL(`../source-analysis/src/${name}.mjs`, root), new URL(`dist/analyzer/${name}.mjs`, root));
}
for (const name of ['static', 'main', 'config', 'remote', 'auth']) {
  const source = await readFile(new URL(`src/${name}.mjs`, root), 'utf8');
  await writeFile(new URL(`dist/${name}.mjs`, root), source.replaceAll('../../source-analysis/src/', './analyzer/'), { mode: 0o755 });
}
