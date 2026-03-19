import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownRenderer } from './MarkdownRenderer';

// Minimal styles object matching every key the component reads.
// Values are the class names themselves so assertions can check className.
const styles: Record<string, string> = {
  codeBlock: 'codeBlock',
  codeLang: 'codeLang',
  inlineCode: 'inlineCode',
  mdH1: 'mdH1',
  mdH2: 'mdH2',
  mdList: 'mdList',
  mdParagraph: 'mdParagraph',
};

describe('MarkdownRenderer', () => {
  // ── Plain text ──────────────────────────────────────────────────────────────

  it('renders plain text without crashing', () => {
    render(<MarkdownRenderer content="Hello world" styles={styles} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  // ── Inline formatting ───────────────────────────────────────────────────────

  it('renders **bold** as a <strong> element', () => {
    render(<MarkdownRenderer content="This is **bold** text" styles={styles} />);
    const strong = document.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('bold');
  });

  it('renders *italic* as an <em> element', () => {
    render(<MarkdownRenderer content="This is *italic* text" styles={styles} />);
    const em = document.querySelector('em');
    expect(em).not.toBeNull();
    expect(em?.textContent).toBe('italic');
  });

  it('renders `inline code` as a <code> element with inlineCode class', () => {
    render(<MarkdownRenderer content="Use `myFunc()` here" styles={styles} />);
    const code = document.querySelector('code');
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe('myFunc()');
    expect(code?.className).toBe('inlineCode');
  });

  // ── Code block ──────────────────────────────────────────────────────────────

  it('renders a triple-backtick code block as a <pre> with codeBlock class', () => {
    const content = '```\nconst x = 1;\n```';
    render(<MarkdownRenderer content={content} styles={styles} />);
    const pre = document.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.className).toBe('codeBlock');
  });

  it('wraps code block body in a <code> element inside <pre>', () => {
    const content = '```\nlet y = 2;\n```';
    render(<MarkdownRenderer content={content} styles={styles} />);
    const code = document.querySelector('pre > code');
    expect(code).not.toBeNull();
    expect(code?.textContent).toContain('let y = 2;');
  });

  it('renders a language tag inside the code block when provided', () => {
    const content = '```typescript\nconst z = 3;\n```';
    render(<MarkdownRenderer content={content} styles={styles} />);
    const langSpan = document.querySelector('pre > span.codeLang');
    expect(langSpan).not.toBeNull();
    expect(langSpan?.textContent).toBe('typescript');
  });

  // ── Headings ────────────────────────────────────────────────────────────────

  // The component maps `#` to <h2> (with mdH1 class) and `##` to <h3> (with mdH2 class).
  it('renders # Heading as an <h2> element with mdH1 class', () => {
    render(<MarkdownRenderer content="# My Heading" styles={styles} />);
    const h2 = document.querySelector('h2');
    expect(h2).not.toBeNull();
    expect(h2?.textContent).toBe('My Heading');
    expect(h2?.className).toBe('mdH1');
  });

  it('renders ## Subheading as an <h3> element with mdH2 class', () => {
    render(<MarkdownRenderer content="## Sub Heading" styles={styles} />);
    const h3 = document.querySelector('h3');
    expect(h3).not.toBeNull();
    expect(h3?.textContent).toBe('Sub Heading');
    expect(h3?.className).toBe('mdH2');
  });

  // ── Lists ───────────────────────────────────────────────────────────────────

  it('renders - items as <li> elements inside a <ul> with mdList class', () => {
    const content = `- Alpha\n- Beta\n- Gamma`;
    const { container } = render(
      <MarkdownRenderer content={content} styles={styles} />
    );
    const ul = container.querySelector('ul');
    expect(ul).not.toBeNull();
    expect(ul?.className).toBe('mdList');

    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe('Alpha');
    expect(items[1].textContent).toBe('Beta');
    expect(items[2].textContent).toBe('Gamma');
  });

  it('renders * items as <li> elements inside a <ul>', () => {
    const content = `* One\n* Two`;
    const { container } = render(
      <MarkdownRenderer content={content} styles={styles} />
    );
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('One');
    expect(items[1].textContent).toBe('Two');
  });

  // ── Empty string ─────────────────────────────────────────────────────────────

  it('renders empty string without crashing and produces no visible content', () => {
    const { container } = render(<MarkdownRenderer content="" styles={styles} />);
    // Fragment with empty content — no paragraph, heading, list, or pre
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('h2')).toBeNull();
    expect(container.querySelector('ul')).toBeNull();
    expect(container.querySelector('pre')).toBeNull();
  });

  // ── Paragraphs ───────────────────────────────────────────────────────────────

  it('renders a plain line as a <p> element with mdParagraph class', () => {
    render(<MarkdownRenderer content="Just a paragraph." styles={styles} />);
    const p = document.querySelector('p');
    expect(p).not.toBeNull();
    expect(p?.textContent).toBe('Just a paragraph.');
    expect(p?.className).toBe('mdParagraph');
  });

  // ── Mixed content ─────────────────────────────────────────────────────────────

  it('renders mixed content: paragraph, code block, and list all present', () => {
    const content = [
      'Intro paragraph.',
      '```',
      'const x = 42;',
      '```',
      '- item one',
      '- item two',
    ].join('\n');

    const { container } = render(<MarkdownRenderer content={content} styles={styles} />);

    expect(container.querySelector('p')).not.toBeNull();
    expect(container.querySelector('pre')).not.toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders inline bold and italic together in the same line', () => {
    render(
      <MarkdownRenderer
        content="Start **strong** and *emphasized* end."
        styles={styles}
      />
    );
    expect(document.querySelector('strong')?.textContent).toBe('strong');
    expect(document.querySelector('em')?.textContent).toBe('emphasized');
  });

  it('renders an empty line as a <br> element', () => {
    const content = 'Line one\n\nLine two';
    render(<MarkdownRenderer content={content} styles={styles} />);
    expect(document.querySelector('br')).not.toBeNull();
  });
});
