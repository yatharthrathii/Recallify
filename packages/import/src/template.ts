import { htmlToText } from './text';

/**
 * Card templates, rendered to the text a card actually showed.
 *
 * A note in the source app is a set of named fields; a card is a template over
 * them: `{{Front}}`, `{{#Extra}}...{{/Extra}}`, `{{cloze:Text}}`. Importing
 * the fields alone would lose which of them the card asked and which it
 * answered, so the templates are rendered. The syntax is small and this covers
 * the parts real templates use: fields, filters, both kinds of conditional,
 * the special names, and cloze deletions including nested ones.
 */

export interface RenderContext {
  /** Field name to raw HTML value. */
  readonly fields: ReadonlyMap<string, string>;
  /** 1-based cloze number this card tests, for cloze note types. */
  readonly clozeOrd: number | null;
  readonly side: 'front' | 'back';
  readonly deckName: string;
  readonly cardName: string;
  readonly noteTypeName: string;
  readonly tags: string;
}

export interface Rendered {
  readonly html: string;
  /**
   * A `{{hint:Field}}` on the question side is a reveal-on-demand extra in the
   * source app. That is what a hint is here too, so it is lifted out of the
   * text rather than printed inline.
   */
  readonly hint: string | null;
}

type Node =
  | { kind: 'text'; text: string }
  | { kind: 'tag'; name: string; filters: readonly string[] }
  | { kind: 'section'; name: string; negated: boolean; children: Node[] };

const TAG = /\{\{([#^/]?)\s*([^{}]*?)\s*\}\}/g;

function parse(template: string): Node[] {
  const root: Node[] = [];
  const stack: { name: string; nodes: Node[] }[] = [];
  let current = root;
  let last = 0;

  for (const match of template.matchAll(TAG)) {
    const [whole, sigil, body] = match as unknown as [string, string, string];
    const at = match.index;
    if (at > last) current.push({ kind: 'text', text: template.slice(last, at) });
    last = at + whole.length;

    if (sigil === '#' || sigil === '^') {
      const section: Node = { kind: 'section', name: body, negated: sigil === '^', children: [] };
      current.push(section);
      stack.push({ name: body, nodes: current });
      current = section.children;
    } else if (sigil === '/') {
      // A stray closer, or one that does not match, is left alone rather than
      // thrown on: a slightly broken template still yields its fields.
      const open = stack.pop();
      if (open) current = open.nodes;
    } else {
      const parts = body.split(':');
      // split() always yields at least one part.
      const name = parts.pop() as string;
      current.push({ kind: 'tag', name, filters: parts.map((p) => p.trim().toLowerCase()) });
    }
  }
  if (last < template.length) current.push({ kind: 'text', text: template.slice(last) });
  return root;
}

const INNERMOST_CLOZE = /\{\{c(\d+)::((?:(?!\{\{)[\s\S])*?)\}\}/g;

/**
 * Cloze deletions. `{{c1::Paris::capital}}` on the front of card 1 is
 * `[capital]`, on any other card it is `Paris`; on the back it is always
 * `Paris`. Innermost first, so a cloze inside a cloze renders correctly.
 */
export function renderCloze(value: string, ord: number, side: 'front' | 'back'): string {
  let out = value;
  for (let guard = 0; guard < 20; guard += 1) {
    const before = out;
    out = out.replace(INNERMOST_CLOZE, (_whole, n: string, content: string) => {
      const sep = content.indexOf('::');
      const answer = sep === -1 ? content : content.slice(0, sep);
      const hint = sep === -1 ? '' : content.slice(sep + 2);
      if (side === 'front' && Number(n) === ord) return hint ? `[${hint}]` : '[...]';
      return answer;
    });
    if (out === before) break;
  }
  return out;
}

/** Only the text under the card's own cloze, for `{{cloze-only:Field}}`. */
function clozeOnly(value: string, ord: number): string {
  const answers: string[] = [];
  for (const match of value.matchAll(INNERMOST_CLOZE)) {
    const [, n, content] = match as unknown as [string, string, string];
    if (Number(n) !== ord) continue;
    const sep = content.indexOf('::');
    answers.push(sep === -1 ? content : content.slice(0, sep));
  }
  return answers.join(', ');
}

function lookup(fields: ReadonlyMap<string, string>, name: string): string | undefined {
  const exact = fields.get(name);
  if (exact !== undefined) return exact;
  const wanted = name.toLowerCase();
  for (const [key, value] of fields) if (key.toLowerCase() === wanted) return value;
  return undefined;
}

function isBlank(value: string): boolean {
  return value.replace(/<br\s*\/?>/gi, '').trim() === '';
}

export function renderTemplate(template: string, ctx: RenderContext): Rendered {
  let hint: string | null = null;

  const special = (name: string): string | undefined => {
    switch (name) {
      case 'FrontSide':
        // The question is shown above the answer already; repeating it inside
        // the answer would print every card twice.
        return '';
      case 'Tags':
        return ctx.tags;
      case 'Type':
        return ctx.noteTypeName;
      case 'Deck':
        return ctx.deckName;
      case 'Subdeck':
        return ctx.deckName.split(' / ').pop() as string;
      case 'Card':
        return ctx.cardName;
      case 'CardFlag':
        return '';
      default:
        return undefined;
    }
  };

  const renderTag = (node: Extract<Node, { kind: 'tag' }>): string => {
    const fixed = special(node.name);
    if (fixed !== undefined) return fixed;
    let value = lookup(ctx.fields, node.name) ?? '';
    // Filters apply right to left, nearest the field first.
    for (let i = node.filters.length - 1; i >= 0; i -= 1) {
      switch (node.filters[i]) {
        case 'cloze':
          value = ctx.clozeOrd === null ? value : renderCloze(value, ctx.clozeOrd, ctx.side);
          break;
        case 'cloze-only':
          value = ctx.clozeOrd === null ? value : clozeOnly(value, ctx.clozeOrd);
          break;
        case 'text':
          value = htmlToText(value).text;
          break;
        case 'type':
          // A typing box on the question side; the answer on the other.
          if (ctx.side === 'front') value = '';
          break;
        case 'hint':
          if (ctx.side === 'front') {
            const plain = htmlToText(value).text;
            if (plain) hint = hint ? `${hint}\n${plain}` : plain;
            value = '';
          }
          break;
        default:
          // Add-on filters (furigana, kana, kanji and the like) keep the field as it is.
          break;
      }
    }
    return value;
  };

  const truthy = (name: string): boolean => {
    const cloze = /^c(\d+)$/.exec(name);
    if (cloze) return ctx.clozeOrd === Number(cloze[1]);
    const fixed = special(name);
    if (fixed !== undefined) return !isBlank(fixed);
    const value = lookup(ctx.fields, name);
    return value !== undefined && !isBlank(value);
  };

  const render = (nodes: readonly Node[]): string => {
    let out = '';
    for (const node of nodes) {
      if (node.kind === 'text') out += node.text;
      else if (node.kind === 'tag') out += renderTag(node);
      else if (truthy(node.name) !== node.negated) out += render(node.children);
    }
    return out;
  };

  const html = render(parse(template));
  return { html, hint };
}
