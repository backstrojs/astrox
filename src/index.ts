import type { AstroIntegration } from 'astro';
import { fileURLToPath } from 'node:url';
import { astroxVitePlugin } from './vite.js';

export default function astrox(): AstroIntegration {
  return {
    name: 'astro-astrox',
    hooks: {
      'astro:config:setup': ({ addRenderer, updateConfig }) => {
        addRenderer({
          name: 'astrox',
          serverEntrypoint: fileURLToPath(new URL('./server.js', import.meta.url)),
          clientEntrypoint: fileURLToPath(new URL('./client.js', import.meta.url)),
        });

        updateConfig({
          vite: {
            plugins: [astroxVitePlugin()],
          },
        });
      },
    },
  };
}
