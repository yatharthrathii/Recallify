import { describe, expect, it } from 'vitest';
import { renderCloze, renderTemplate, type RenderContext } from '../src/template';

function ctx(
  fields: Record<string, string>,
  overrides: Partial<RenderContext> = {},
): RenderContext {
  return {
    fields: new Map(Object.entries(fields)),
    clozeOrd: null,
    side: 'front',
    deckName: 'Japanese / Vocab',
    cardName: 'Card 1',
    noteTypeName: 'Basic',
    tags: 'n5 verbs',
    ...overrides,
  };
}

describe('renderTemplate', () => {
  it('substitutes fields and leaves unknown ones empty', () => {
    const out = renderTemplate('{{Front}} / {{Missing}} / {{ Back }}', ctx({ Front: 'a', Back: 'b' }));
    expect(out.html).toBe('a /  / b');
    expect(out.hint).toBeNull();
  });

  it('finds a field regardless of case', () => {
    expect(renderTemplate('{{front}}', ctx({ Front: 'a' })).html).toBe('a');
  });

  it('includes a section only when its field has content', () => {
    const t = '{{#Extra}}[{{Extra}}]{{/Extra}}{{^Extra}}(none){{/Extra}}';
    expect(renderTemplate(t, ctx({ Extra: 'x' })).html).toBe('[x]');
    expect(renderTemplate(t, ctx({ Extra: '' })).html).toBe('(none)');
    expect(renderTemplate(t, ctx({ Extra: ' <br> ' })).html).toBe('(none)');
    expect(renderTemplate(t, ctx({})).html).toBe('(none)');
  });

  it('tolerates a closer that matches nothing', () => {
    expect(renderTemplate('a{{/Nope}}b', ctx({})).html).toBe('ab');
  });

  it('renders the special names, and FrontSide as nothing', () => {
    const t = '{{FrontSide}}|{{Tags}}|{{Type}}|{{Deck}}|{{Subdeck}}|{{Card}}|{{CardFlag}}';
    expect(renderTemplate(t, ctx({}, { side: 'back' })).html).toBe(
      '|n5 verbs|Basic|Japanese / Vocab|Vocab|Card 1|',
    );
    expect(renderTemplate('{{Subdeck}}', ctx({}, { deckName: 'Flat' })).html).toBe('Flat');
    expect(renderTemplate('{{#Tags}}tagged{{/Tags}}{{#CardFlag}}flag{{/CardFlag}}', ctx({})).html).toBe(
      'tagged',
    );
  });

  it('lifts a hint filter out of the question and prints it on the answer', () => {
    const front = renderTemplate('{{Front}}{{hint:Hint}}{{hint:Hint2}}', ctx({ Front: 'q', Hint: '<b>h</b>', Hint2: 'h2' }));
    expect(front.html).toBe('q');
    expect(front.hint).toBe('h\nh2');
    const back = renderTemplate('{{hint:Hint}}', ctx({ Hint: 'h' }, { side: 'back' }));
    expect(back.html).toBe('h');
    expect(back.hint).toBeNull();
    // An empty hint field contributes no hint.
    expect(renderTemplate('{{hint:Hint}}', ctx({ Hint: '' })).hint).toBeNull();
  });

  it('hides a typing box on the question side and shows the answer on the other', () => {
    expect(renderTemplate('{{type:Back}}', ctx({ Back: 'b' })).html).toBe('');
    expect(renderTemplate('{{type:Back}}', ctx({ Back: 'b' }, { side: 'back' })).html).toBe('b');
  });

  it('applies text and unknown filters', () => {
    expect(renderTemplate('{{text:Back}}', ctx({ Back: '<i>b</i>' })).html).toBe('b');
    expect(renderTemplate('{{furigana:Back}}', ctx({ Back: 'x' })).html).toBe('x');
  });

  it('renders cloze deletions for the card under test', () => {
    const fields = { Text: 'The {{c1::cat}} sat on the {{c2::mat::where}}.' };
    expect(renderTemplate('{{cloze:Text}}', ctx(fields, { clozeOrd: 1 })).html).toBe(
      'The [...] sat on the mat.',
    );
    expect(renderTemplate('{{cloze:Text}}', ctx(fields, { clozeOrd: 2 })).html).toBe(
      'The cat sat on the [where].',
    );
    expect(renderTemplate('{{cloze:Text}}', ctx(fields, { clozeOrd: 2, side: 'back' })).html).toBe(
      'The cat sat on the mat.',
    );
    // On a non-cloze note the filter leaves the field alone.
    expect(renderTemplate('{{cloze:Text}}', ctx(fields)).html).toBe(fields.Text);
  });

  it('renders only the tested cloze with cloze-only', () => {
    const fields = { Text: '{{c1::a}} and {{c1::b::hint}} and {{c2::c}}' };
    expect(renderTemplate('{{cloze-only:Text}}', ctx(fields, { clozeOrd: 1 })).html).toBe('a, b');
    expect(renderTemplate('{{cloze-only:Text}}', ctx(fields)).html).toBe(fields.Text);
  });

  it('shows a section for the card own cloze number', () => {
    const t = '{{#c1}}first{{/c1}}{{^c1}}other{{/c1}}';
    expect(renderTemplate(t, ctx({}, { clozeOrd: 1 })).html).toBe('first');
    expect(renderTemplate(t, ctx({}, { clozeOrd: 2 })).html).toBe('other');
  });
});

describe('renderCloze', () => {
  it('handles a cloze inside a cloze, innermost first', () => {
    const text = '{{c1::outer {{c2::inner}} end}}';
    expect(renderCloze(text, 1, 'front')).toBe('[...]');
    expect(renderCloze(text, 2, 'front')).toBe('outer [...] end');
    expect(renderCloze(text, 2, 'back')).toBe('outer inner end');
  });

  it('leaves text without clozes alone', () => {
    expect(renderCloze('plain', 1, 'front')).toBe('plain');
  });
});
