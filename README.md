# Astrox

Astro-like components that compile to **Preact** — with function event handlers, signals, and full Astro tooling support.

Write `.astrox` files with the same frontmatter + template syntax as Astro, but get real Preact components with:

- **Preact Signals** for reactive state
- **Function event handlers** (`onclick={handler}`)
- **Client-side interactivity** via Astro's island architecture

## Installation

```bash
npm install @backstro/astrox
```

This automatically:
- Patches Astro's JSX types to accept function event handlers
- Adds `*.astrox` → `astro` file association to `.vscode/settings.json`

## Setup

### 1. Add the integration to `astro.config.mjs`

```js
import { defineConfig } from 'astro/config';
import astrox from 'astrox';

export default defineConfig({
  integrations: [astrox()],
});
```

That's it. VS Code will automatically use the Astro language mode for `.astrox` files, giving you full syntax highlighting, TypeScript autocomplete, and HTML completions.

## Usage

> To use signals you will need to install `@preact/signals`
>  ```bash
>  npm install @preact/signals
>  ```

Create a `.astrox` file:

```astro
---
import { signal } from '@preact/signals';

const count = signal(0);

function increment() {
  count.value++;
}
---

<div class="counter">
  <button onclick={increment}>+</button>
  <span>{count}</span>
</div>
```

Use it in an Astro page with a client directive:

```astro
---
import Counter from '../components/Counter.astrox';
---

<Counter client:load />
```

## How it works

1. The **Vite plugin** intercepts `.astrox` files and compiles them using `@astrojs/compiler`
2. Frontmatter becomes module-level JavaScript
3. The result is a standard **Preact function component** that works with Astro's island hydration
4. A **postinstall script** patches Astro's JSX types and configures VS Code file associations

## Type patching

On `npm install @backstro/astrox`, astrox automatically:

1. Patches `node_modules/astro/astro-jsx.d.ts` — widens event handler types from `string` to `string | Function`, so `onclick={myHandler}` works without TypeScript errors
2. Updates `.vscode/settings.json` — adds `"*.astrox": "astro"` file association for full editor support
3. Patches the Astro VS Code extension's TS plugin — registers `.astrox` as a known file extension so imports between `.astrox` components resolve correctly in the editor

All patches are idempotent and safe to re-run.

## License

MIT
