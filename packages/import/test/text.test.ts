import { describe, expect, it } from 'vitest';
import { decodeEntities, htmlToText } from '../src/text';

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities and leaves the rest', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot; &nbsp;e')).toBe('a & b <c> "d"  e');
    expect(decodeEntities('&#65;&#x42;&#X43;')).toBe('ABC');
    expect(decodeEntities('&unknown; &#0; &#1114112;')).toBe('&unknown; &#0; &#1114112;');
    expect(decodeEntities('&rarr; &Alpha; &hellip;')).toBe('→ α …');
  });
});

describe('htmlToText', () => {
  it('keeps line structure from breaks, blocks and lists', () => {
    const { text } = htmlToText(
      '<div>one</div><p>two<br>three</p><ul><li>four</li><li>five</li></ul><hr>six<h2>seven</h2>',
    );
    expect(text).toBe('one\ntwo\nthree\nfour\nfive\nsix\nseven');
  });

  it('keeps a blank line only where two breaks were typed', () => {
    expect(htmlToText('<div>a<br><br>b</div><div>c</div>').text).toBe('a\n\nb\nc');
    expect(htmlToText('a<br><br><br><br>b').text).toBe('a\n\nb');
  });

  it('counts media and removes it', () => {
    const { text, media } = htmlToText('Word <img src="a.png"> [sound:a.mp3] <audio src="b.mp3"></audio>');
    expect(text).toBe('Word');
    expect(media).toBe(3);
  });

  it('drops styles and scripts, keeps maths delimiters', () => {
    const { text } = htmlToText(
      '<style>.x{}</style><script>1</script>E = <anki-mathjax>mc^2</anki-mathjax> and <anki-mathjax block="true">x</anki-mathjax>',
    );
    expect(text).toBe('E = \\(mc^2\\) and \\[x\\]');
  });

  it('tidies whitespace: tabs, nbsp, windows newlines, runs of blank lines', () => {
    const { text } = htmlToText('  a \t b&nbsp;c\r\n\r\n\r\n\r\nd  <td>e</td><td>f</td> ');
    // Bare newlines in HTML are whitespace; several in a row are one line end.
    expect(text).toBe('a b c\nd e f');
  });

  it('returns an empty string for markup with no text', () => {
    expect(htmlToText('<div><br></div>').text).toBe('');
    expect(htmlToText('').text).toBe('');
  });
});
