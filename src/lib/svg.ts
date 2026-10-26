const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath',
]);

const ALLOWED_ATTRIBUTES = new Set([
  'xmlns', 'viewbox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'd', 'points', 'fill', 'fillrule', 'stroke', 'strokewidth', 'strokelinecap', 'strokelinejoin', 'strokedasharray',
  'opacity', 'fillopacity', 'strokeopacity', 'transform', 'id', 'offset', 'stopcolor', 'stopopacity', 'gradientunits',
]);

/** Restricts generated inline SVG to passive vector geometry and local paint definitions. */
export const sanitizeInlineSvg = (input?: string): string | undefined => {
  if (!input) return undefined;
  const source = input.trim();
  if (source.length > 16_000 || !/^<svg\b/i.test(source) || !/<\/svg\s*>$/i.test(source)) return undefined;
  if (/&|<!|<\?|<!--|\b(?:script|foreignobject|iframe|object|embed|image|audio|video)\b|\bon[a-z]+\s*=|\b(?:href|style)\s*=|javascript:|data:/i.test(source)) return undefined;

  const tags = source.match(/<[^>]*>/g);
  if (!tags?.length || source.replace(/<[^>]*>/g, '').trim()) return undefined;
  const stack: string[] = [];
  let rootCount = 0;
  for (const tag of tags) {
    const match = tag.match(/^<\s*(\/?)\s*([a-z][\w:-]*)([\s\S]*?)(\/?)\s*>$/i);
    if (!match) return undefined;
    const [, closing, name, rawAttributes = '', selfClosing] = match;
    if (!ALLOWED_TAGS.has(name!)) return undefined;
    if (closing) {
      if (rawAttributes.trim() || selfClosing) return undefined;
      if (stack.pop() !== name) return undefined;
      continue;
    }
    if (!stack.length && (name !== 'svg' || ++rootCount > 1)) return undefined;
    if (!selfClosing) stack.push(name!);
    const attributes = rawAttributes.replace(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (attribute, key: string, doubleValue: string | undefined, singleValue: string | undefined) => {
      const normalizedKey = key.replace(/[-:]/g, '').toLowerCase();
      if (!ALLOWED_ATTRIBUTES.has(normalizedKey)) return attribute;
      const value = (doubleValue ?? singleValue ?? '').trim();
      if (normalizedKey === 'xmlns' && value && value !== 'http://www.w3.org/2000/svg') return attribute;
      if (['fill', 'stroke', 'stopcolor'].includes(normalizedKey)) {
        if (/url\((?!\s*#[\w-]+\s*\))/i.test(value)) return attribute;
      }
      return '';
    });
    if (attributes.replace(/[\s/]/g, '')) return undefined;
  }
  return stack.length === 0 && rootCount === 1 ? source : undefined;
};

export const responsiveSvg = (input?: string) => {
  const safe = sanitizeInlineSvg(input);
  if (!safe) return undefined;
  return safe.replace(/<svg\b([^>]*)>/i, (_tag, attributes: string) => {
    const cleanAttributes = attributes.replace(/\s(?:width|height|preserveAspectRatio)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
    return `<svg${cleanAttributes} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
  });
};
