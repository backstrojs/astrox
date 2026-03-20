import { parse } from '@astrojs/compiler';

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

interface Node {
  type: string;
  name?: string;
  value?: string;
  attributes?: Attribute[];
  children?: Node[];
}

interface Attribute {
  type: string;
  kind: string;
  name: string;
  value: string;
}

export async function compileAstrox(source: string, _id: string): Promise<string> {
  const { ast } = await parse(source);
  let frontmatter = '';
  const templateNodes: Node[] = [];

  for (const child of (ast as any).children) {
    if (child.type === 'frontmatter') {
      frontmatter = child.value || '';
    } else {
      templateNodes.push(child);
    }
  }

  const { imports, body } = splitFrontmatter(frontmatter);
  const template = templateNodes.map(serializeNode).join('');

  return [
    `import { h } from 'preact';`,
    `import htm from 'htm';`,
    `const html = htm.bind(h);`,
    '',
    ...imports,
    '',
    ...body,
    '',
    `function Component(props) {`,
    '  return html`' + template + '`;',
    `}`,
    '',
    `Component.__astrox = true;`,
    `export default Component;`,
    '',
  ].join('\n');
}

function splitFrontmatter(code: string): { imports: string[]; body: string[] } {
  const lines = code.split('\n');
  const imports: string[] = [];
  const body: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith('import ')) {
      imports.push(line);
    } else {
      body.push(line);
    }
  }

  return { imports, body };
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

function serializeNode(node: Node): string {
  switch (node.type) {
    case 'text':
      return escapeText(node.value || '');
    case 'expression':
      return '${' + expressionContent(node) + '}';
    case 'element':
    case 'component':
    case 'custom-element':
      return serializeElement(node);
    case 'fragment':
      return (node.children || []).map(serializeNode).join('');
    default:
      return '';
  }
}

function expressionContent(node: Node): string {
  if (!node.children?.length) return '';

  if (node.children.every((c) => c.type === 'text')) {
    return node.children.map((c) => c.value || '').join('');
  }

  return node.children
    .map((child) => {
      if (child.type === 'text') return child.value || '';
      return 'html`' + serializeNode(child) + '`';
    })
    .join('');
}

function serializeElement(node: Node): string {
  const name = node.name || 'div';

  if (name === 'slot') {
    return '${props.children}';
  }

  const isComponent = /^[A-Z]/.test(name);
  const open = isComponent ? '${' + name + '}' : name;
  const close = isComponent ? '${' + name + '}' : name;

  let attrs = '';
  for (const attr of node.attributes || []) {
    attrs += serializeAttr(attr);
  }

  const children = node.children || [];
  if (children.length === 0 || VOID_ELEMENTS.has(name.toLowerCase())) {
    return `<${open}${attrs} />`;
  }

  return `<${open}${attrs}>${children.map(serializeNode).join('')}</${close}>`;
}

function serializeAttr(attr: Attribute): string {
  const name = toCamelCaseEvent(attr.name);
  switch (attr.kind) {
    case 'empty':
      return ` ${name}`;
    case 'quoted':
      return ` ${name}="${escapeText(attr.value)}"`;
    case 'expression':
      return ` ${name}=\${${attr.value}}`;
    case 'shorthand':
      return ` ${name}=\${${name}}`;
    case 'spread':
      return ` ...\${${attr.name}}`;
    case 'template-literal':
      return ` ${name}=\${\`${attr.value}\`}`;
    default:
      return attr.value
        ? ` ${name}="${escapeText(attr.value)}"`
        : ` ${name}`;
  }
}

/** Convert lowercase event attrs (onclick) to camelCase (onClick) for Preact. */
function toCamelCaseEvent(name: string): string {
  if (!name.startsWith('on') || name.length < 3) return name;
  if (name[2] >= 'A' && name[2] <= 'Z') return name;
  return 'on' + name[2].toUpperCase() + name.slice(3);
}
