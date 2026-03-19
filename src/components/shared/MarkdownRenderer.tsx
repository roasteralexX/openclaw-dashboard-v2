import type { ReactNode } from 'react';

interface MarkdownRendererProps {
  content: string;
  /** CSS Modules styles object — must provide: codeBlock, inlineCode, bold, italic, h1, h2, ul, li */
  styles: Record<string, string>;
}

function renderInline(text: string, key: string, styles: Record<string, string>): ReactNode[] {
  const parts: ReactNode[] = [];
  let remaining = text;
  let si = 0;

  while (remaining.length > 0) {
    const boldM   = remaining.match(/^(.*?)\*\*(.+?)\*\*/);
    const italicM = remaining.match(/^(.*?)\*([^*]+?)\*/);
    const codeM   = remaining.match(/^(.*?)`([^`]+?)`/);

    const candidates: Array<{ match: RegExpMatchArray; type: string; len: number }> = [];
    if (boldM)   candidates.push({ match: boldM,   type: 'bold',   len: boldM[0].length });
    if (italicM) candidates.push({ match: italicM, type: 'italic', len: italicM[0].length });
    if (codeM)   candidates.push({ match: codeM,   type: 'code',   len: codeM[0].length });

    if (candidates.length === 0) { parts.push(remaining); break; }
    candidates.sort((a, b) => a.match[1].length - b.match[1].length);

    const winner = candidates[0];
    if (winner.match[1]) parts.push(winner.match[1]);
    const content = winner.match[2];
    if (winner.type === 'bold')   parts.push(<strong key={`${key}-b-${si++}`}>{content}</strong>);
    if (winner.type === 'italic') parts.push(<em     key={`${key}-i-${si++}`}>{content}</em>);
    if (winner.type === 'code')   parts.push(<code   key={`${key}-c-${si++}`} className={styles.inlineCode}>{content}</code>);
    remaining = remaining.slice(winner.len);
  }
  return parts;
}

function renderMarkdown(text: string, moduleStyles: Record<string, string>): ReactNode[] {
  const lines = text.split('\n');
  const result: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      result.push(
        <pre key={`pre-${i}`} className={moduleStyles.codeBlock}>
          {lang && <span className={moduleStyles.codeLang}>{lang}</span>}
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      result.push(<h2 key={`h1-${i}`} className={moduleStyles.mdH1}>{line.slice(2)}</h2>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      result.push(<h3 key={`h2-${i}`} className={moduleStyles.mdH2}>{line.slice(3)}</h3>);
      i++;
      continue;
    }

    // Unordered list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const listItems: ReactNode[] = [];
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        listItems.push(<li key={`li-${i}`}>{renderInline(lines[i].slice(2), `li-${i}`, moduleStyles)}</li>);
        i++;
      }
      result.push(<ul key={`ul-${i}`} className={moduleStyles.mdList}>{listItems}</ul>);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      result.push(<br key={`br-${i}`} />);
      i++;
      continue;
    }

    // Regular paragraph
    result.push(
      <p key={`p-${i}`} className={moduleStyles.mdParagraph}>
        {renderInline(line, `p-${i}`, moduleStyles)}
      </p>
    );
    i++;
  }

  return result;
}

export function MarkdownRenderer({ content, styles }: MarkdownRendererProps): ReactNode {
  return <>{renderMarkdown(content, styles)}</>;
}
