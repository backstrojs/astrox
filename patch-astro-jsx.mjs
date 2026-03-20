#!/usr/bin/env node

/**
 * Astrox postinstall script:
 * 1. Patches astro's JSX types to accept function event handlers
 * 2. Ensures .vscode/settings.json maps *.astrox → astro language mode
 *
 * Runs automatically via postinstall when you `npm install astrox`.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';

// ─── 1. Patch astro-jsx.d.ts ────────────────────────────────────────────────

const MARKER = 'AstroxEventHandler';

let filePath;
try {
  const require = createRequire(resolve('package.json'));
  const astroEntry = require.resolve('astro');
  filePath = resolve(dirname(astroEntry), '..', 'astro-jsx.d.ts');
} catch {
  filePath = resolve('node_modules', 'astro', 'astro-jsx.d.ts');
}

let content;
try {
  content = readFileSync(filePath, 'utf8');
} catch {
  // astro not installed (yet) — skip silently
  content = null;
}

if (content && !content.includes(MARKER)) {
  const patched = content.replace(
    'declare namespace astroHTML.JSX {',
    `declare namespace astroHTML.JSX {\n\ttype ${MARKER} = string | ((...args: any[]) => any) | undefined | null;`,
  );

  const result = patched.replace(
    /(\bon[a-z]+\?:\s*)string \| undefined \| null;/g,
    `$1${MARKER};`,
  );

  writeFileSync(filePath, result, 'utf8');
  const count = (result.match(new RegExp(`${MARKER};`, 'g')) || []).length;
  console.log(`[astrox] Patched ${count} event handler types in astro-jsx.d.ts`);
}

// ─── 2. Ensure .vscode/settings.json has *.astrox → astro ───────────────────

const vscodeDir = resolve('.vscode');
const settingsPath = resolve(vscodeDir, 'settings.json');

try {
  if (!existsSync(vscodeDir)) {
    mkdirSync(vscodeDir, { recursive: true });
  }

  let settings = {};
  if (existsSync(settingsPath)) {
    const raw = readFileSync(settingsPath, 'utf8');
    // Strip JSON5-style comments: full-line and inline // comments (outside strings)
    const stripped = raw
      .replace(/("(?:[^"\\]|\\.)*")|\/\/.*/g, (m, str) => str || '')
      .replace(/,(\s*[}\]])/g, '$1');
    try {
      settings = JSON.parse(stripped);
    } catch {
      if (!raw.includes('"*.astrox"')) {
        console.log('[astrox] Could not parse .vscode/settings.json — please add manually:');
        console.log('  "files.associations": { "*.astrox": "astro" }');
      }
      process.exit(0);
    }
  }

  const assoc = settings['files.associations'] || {};
  if (assoc['*.astrox'] === 'astro') {
    // Already configured
    process.exit(0);
  }

  assoc['*.astrox'] = 'astro';
  settings['files.associations'] = assoc;

  writeFileSync(settingsPath, JSON.stringify(settings, null, '\t') + '\n', 'utf8');
  console.log('[astrox] Added *.astrox → astro file association to .vscode/settings.json');
} catch (err) {
  console.warn(`[astrox] Could not update .vscode/settings.json: ${err.message}`);
}
