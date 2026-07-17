import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/;

const ALLOWLIST = new Map<string, string>([
  ['src/client/i18n/locales/zh-Hant.json', 'Traditional Chinese locale resource data.'],
  ['src/client/i18n/locales/zh-Hans.json', 'Simplified Chinese locale resource data.'],
  ['src/client/config.ts', 'Locale switcher endonym constants are product data, not prose.'],
  ['tests/unit/i18n.test.ts', 'Pins endonym constants and locale-file data.'],
  ['tests/unit/client/table.test.ts', 'Asserts rendered locale output for zh-Hant and zh-Hans.'],
  ['tests/unit/client/seat-stack.test.tsx', 'Asserts the rendered zh-Hant count-unit label.'],
]);

const SCAN_ROOTS = ['src', 'tests', 'scripts'];
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

function toRepoPath(path: string): string {
  return relative(ROOT, path).split(sep).join('/');
}

function extensionOf(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  const base = lastSlash === -1 ? path : path.slice(lastSlash + 1);
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot);
}

async function walk(dir: string, out: string[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    const repoPath = toRepoPath(fullPath);
    if (ALLOWLIST.has(repoPath)) continue;
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      await walk(fullPath, out);
      continue;
    }
    if (entry.isFile() && TEXT_EXTENSIONS.has(extensionOf(repoPath))) {
      out.push(fullPath);
    }
  }
}

describe('English-only source sweep', () => {
  it('keeps CJK characters out of source, tests, and scripts except locale data', async () => {
    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
      await walk(join(ROOT, root), files);
    }

    const hits: string[] = [];
    for (const file of files.sort()) {
      const text = await readFile(file, 'utf8');
      text.split(/\r?\n/).forEach((line, index) => {
        if (CJK_RE.test(line)) {
          hits.push(`${toRepoPath(file)}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    expect(hits, `CJK characters found outside allowlisted locale data:\n${hits.join('\n')}`).toEqual([]);
  });
});
