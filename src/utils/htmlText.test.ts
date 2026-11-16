import { describe, expect, it } from 'vitest';
import { escapeHtml, htmlToText, textToHtml, wrapMailHtml } from './htmlText';

describe('escapeHtml', () => {
  it('should escape html special characters', () => {
    expect(escapeHtml('<b>"A" & \'B\'</b>')).toBe('&lt;b&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/b&gt;');
  });
});

describe('textToHtml', () => {
  it('should wrap lines into paragraphs and escape content', () => {
    const html = textToHtml('第一行\n<b>标签</b>');
    expect(html).toBe('<p>第一行</p><p>&lt;b&gt;标签&lt;/b&gt;</p>');
  });

  it('should render empty lines as line breaks', () => {
    expect(textToHtml('a\n\nb')).toBe('<p>a</p><p><br></p><p>b</p>');
  });
});

describe('htmlToText', () => {
  it('should strip tags and keep line breaks from block elements', () => {
    const text = htmlToText('<p>第一段</p><p>第二段</p>');
    expect(text).toBe('第一段\n第二段');
  });

  it('should convert br to newline and list items to bullets', () => {
    expect(htmlToText('行一<br>行二<ul><li>条目</li></ul>')).toBe('行一\n行二\n• 条目');
  });

  it('should decode basic entities', () => {
    expect(htmlToText('<p>A &amp; B&nbsp;C &lt;ok&gt;</p>')).toBe('A & B C <ok>');
  });

  it('should collapse excessive newlines', () => {
    expect(htmlToText('<p>a</p><p></p><p></p><p></p><p>b</p>')).toBe('a\n\nb');
  });
});

describe('wrapMailHtml', () => {
  it('should wrap mail html into a full document with body content', () => {
    const doc = wrapMailHtml('<p>正文</p>', { dark: false });
    expect(doc).toContain('<body><p>正文</p></body>');
    expect(doc).toContain('<meta charset="utf-8">');
  });

  it('should inject dark overrides when dark is true', () => {
    const doc = wrapMailHtml('<p>正文</p>', { dark: true });
    expect(doc).toContain('color-scheme: dark');
    expect(doc).toContain('background-color: transparent !important');
  });

  it('should not inject dark overrides in light mode', () => {
    const doc = wrapMailHtml('<p>正文</p>', { dark: false });
    expect(doc).not.toContain('color-scheme: dark');
  });

  it('should apply custom root font size', () => {
    const doc = wrapMailHtml('<p>正文</p>', { dark: false, rootFontSize: 18 });
    expect(doc).toContain('font-size: 18px');
  });
});
