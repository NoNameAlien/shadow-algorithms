import { promises as fs } from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = process.cwd();
const SOURCE_DIR = path.join(PROJECT_ROOT, 'src');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'src-code.txt');

const TEXT_FILE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.wgsl',
]);

const toProjectPath = (absolutePath) => path.relative(PROJECT_ROOT, absolutePath).split(path.sep).join('/');

const isTextFile = (filePath) => TEXT_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && isTextFile(entryPath)) {
      files.push(entryPath);
    }
  }

  return files.sort((left, right) => toProjectPath(left).localeCompare(toProjectPath(right)));
}

async function main() {
  const files = await collectFiles(SOURCE_DIR);
  const chunks = [];

  for (const file of files) {
    const projectPath = toProjectPath(file);
    const code = await fs.readFile(file, 'utf8');
    chunks.push(`${projectPath}\n${code.trimEnd()}`);
  }

  await fs.writeFile(OUTPUT_FILE, `${chunks.join('\n\n')}\n`, 'utf8');

  console.log(`Collected ${files.length} files into ${toProjectPath(OUTPUT_FILE)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
