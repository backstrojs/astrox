export default (element: HTMLElement) => {
  return async (
    Component: any,
    props: Record<string, any>,
    slotted: Record<string, string>,
  ) => {
    const { h, render } = await import('preact');

    let children;
    if (slotted?.default) {
      children = h('astro-slot', {
        dangerouslySetInnerHTML: { __html: slotted.default },
      });
    }

    render(h(Component, props, children), element);
  };
};
