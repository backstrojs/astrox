/// <reference types="astro/client" />

declare module '*.astrox' {
  const Component: import('preact').FunctionComponent<any>;
  export default Component;
}
