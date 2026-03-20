#!/usr/bin/env node

/**
 * Astrox postinstall script:
 * 1. Patches astro's JSX types to accept function event handlers
 * 2. Ensures .vscode/settings.json maps *.astrox → astro language mode
 * 3. Patches the Astro VS Code extension's TS plugin to resolve .astrox imports
 *
 * Runs automatically via postinstall when you `npm install astrox`.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';

// ─── Resolve the consumer project root ──────────────────────────────────────
// INIT_CWD is set by npm/yarn/pnpm to the directory where the install was
// invoked, i.e. the project that depends on astrox — not our own package dir.
const projectRoot = process.env.INIT_CWD || process.env.npm_config_local_prefix || resolve('..', '..', '..');

// ─── 1. Patch astro-jsx.d.ts ────────────────────────────────────────────────

const MARKER = 'AstroxEventHandler';

let filePath;
try {
  const require = createRequire(resolve(projectRoot, 'package.json'));
  const astroEntry = require.resolve('astro');
  filePath = resolve(dirname(astroEntry), '..', 'astro-jsx.d.ts');
} catch {
  filePath = resolve(projectRoot, 'node_modules', 'astro', 'astro-jsx.d.ts');
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

const vscodeDir = resolve(projectRoot, '.vscode');
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
    }
  }

  const assoc = settings['files.associations'] || {};
  if (assoc['*.astrox'] !== 'astro') {
    assoc['*.astrox'] = 'astro';
    settings['files.associations'] = assoc;

    writeFileSync(settingsPath, JSON.stringify(settings, null, '\t') + '\n', 'utf8');
    console.log('[astrox] Added *.astrox → astro file association to .vscode/settings.json');
  }
} catch (err) {
  console.warn(`[astrox] Could not update .vscode/settings.json: ${err.message}`);
}

// ─── 3. Patch Astro VS Code extension TS plugin to resolve .astrox imports ──

const ASTROX_TS_MARKER = '.astrox';

// Locate the VS Code extensions directory (supports VS Code, Insiders, Cursor)
const home = homedir();
const editorDirs = ['.vscode', '.vscode-insiders', '.cursor']
  .map(d => join(home, d, 'extensions'))
  .filter(d => existsSync(d));

/**
 * Apply .astrox patches to a file:
 * 1. getLanguageId: recognize .astrox as "astro"
 * 2. extraFileExtensions: register .astrox for TS module resolution
 */
function patchFileForAstrox(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return false;
  }

  if (content.includes(ASTROX_TS_MARKER)) return false; // Already patched

  let patched = content;

  // Patch getLanguageId: e.g. n.endsWith(".astro"))return"astro"
  // In the language server it's: t.path.endsWith(".astro"))return"astro"
  patched = patched.replace(
    /(\w+(?:\.\w+)?)\.endsWith\("\.astro"\)\)return"astro"/g,
    (match, varExpr) => `${varExpr}.endsWith(".astro")||${varExpr}.endsWith(".astrox"))return"astro"`,
  );

  // Patch extraFileExtensions to include .astrox
  patched = patched.replace(
    /\{extension:"astro",isMixedContent:!0,scriptKind:7\}\]/g,
    '{extension:"astro",isMixedContent:!0,scriptKind:7},{extension:"astrox",isMixedContent:!0,scriptKind:7}]',
  );

  if (patched !== content) {
    writeFileSync(filePath, patched, 'utf8');
    return true;
  }
  return false;
}

for (const extDir of editorDirs) {
  try {
    const entries = readdirSync(extDir);
    const astroDirs = entries.filter(e => e.startsWith('astro-build.astro-vscode-'));

    for (const astroDir of astroDirs) {
      const patchTargets = [
        join(extDir, astroDir, 'dist', 'node', 'server.js'),
        join(extDir, astroDir, 'node_modules', 'astro-ts-plugin-bundle', 'index.js'),
      ];

      let patchedAny = false;
      for (const target of patchTargets) {
        if (existsSync(target) && patchFileForAstrox(target)) {
          patchedAny = true;
        }
      }

      if (patchedAny) {
        console.log(`[astrox] Patched Astro extension for .astrox support in ${astroDir}`);
      }
    }
  } catch (err) {
    console.warn(`[astrox] Could not patch Astro extension in ${extDir}: ${err.message}`);
  }
}
