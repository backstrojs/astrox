import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';
import { compileAstrox } from './compiler.js';

export function astroxVitePlugin(): Plugin {
  return {
    name: 'vite-plugin-astrox',
    enforce: 'pre',

    async load(id) {
      if (!id.endsWith('.astrox')) return;

      this.addWatchFile(id);
      const source = await readFile(id, 'utf-8');
      return compileAstrox(source, id);
    },

    hotUpdate({ file, server }) {
      if (!file.endsWith('.astrox')) {
        return;
      }
      server.hot.send({ type: 'full-reload' });
      return [];
    },
  };
}
