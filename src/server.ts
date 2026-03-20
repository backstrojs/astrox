export default {
  name: 'astrox',

  check: async (Component: any) => {
    return !!Component?.__astrox;
  },

  renderToStaticMarkup: async () => {
    // Client-only rendering for v1 — no SSR output
    return { html: '' };
  },

  supportsAstroStaticSlot: true,
};
