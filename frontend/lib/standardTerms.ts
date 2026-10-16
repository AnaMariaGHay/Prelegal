// Parses Common Paper Standard Terms markdown into a small document model that both the
// HTML preview and the PDF can render.
//
// The templates only use a handful of constructs, so this is deliberately not a general
// markdown parser: "# " headings, numbered clauses nested by four-space indentation
// ("1.", "    1.", "        a.", "            i."), plain paragraphs, and inline
// **bold**, [links](url), <autolinks>, <span class="header_3">headings</span> and
// <span class="coverpage_link">Term</span> references to cover page fields.

export type Run = {
  text: string;
  bold?: boolean;
  href?: string;
  /** A defined term whose value is set on the cover page, e.g. "Purpose". */
  term?: string;
};

export type Block =
  | { kind: "heading"; text: string }
  /** `label` is the clause's number as cited in the terms: "5.", "5.2" or "(a)". */
  | { kind: "clause"; level: number; label: string; runs: Run[] }
  | { kind: "paragraph"; runs: Run[] };

const INLINE =
  /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|<span class="\w+_link"[^>]*>(.+?)<\/span>|<(https?:\/\/[^>\s]+)>/g;

function tidy(text: string) {
  return (
    text
      // Anchor-only spans: keep the text, drop the tag.
      .replace(/<span id="[^"]*">(.*?)<\/span>/g, "$1")
      // Section headings inside clauses read as bold.
      .replace(/<span class="header_\d"[^>]*>(.*?)<\/span>/g, "**$1**")
      .replace(/<\/?label>/g, "")
  );
}

export function parseInline(text: string, bold = false): Run[] {
  const runs: Run[] = [];
  const plain = (t: string) => runs.push(bold ? { text: t, bold } : { text: t });
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) plain(text.slice(last, m.index));
    if (m[1] !== undefined) runs.push(...parseInline(m[1], true));
    else if (m[2] !== undefined) runs.push({ text: m[2], href: m[3].startsWith("http") ? m[3] : `https://${m[3]}`, bold });
    else if (m[4] !== undefined) runs.push({ text: m[4], term: m[4], bold });
    else runs.push({ text: m[5], href: m[5], bold });
    last = m.index + m[0].length;
  }
  if (last < text.length) plain(text.slice(last));
  return runs;
}

export function parseStandardTerms(markdown: string): Block[] {
  const blocks: Block[] = [];
  const numbers: string[] = []; // the current clause number at each level
  for (const raw of markdown.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const indent = raw.match(/^ */)![0].length;
    const line = tidy(raw.trim());
    const heading = line.match(/^#+\s+(.*)$/);
    const clause = line.match(/^([0-9]+|[a-z]+)\.\s*(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", text: heading[1] });
    } else if (clause) {
      const level = Math.floor(indent / 4);
      numbers[level] = clause[1];
      numbers.length = level + 1;
      const label = level === 0 ? `${clause[1]}.` : level === 1 ? `${numbers[0]}.${clause[1]}` : `(${clause[1]})`;
      blocks.push({ kind: "clause", level, label, runs: parseInline(clause[2]) });
    } else {
      blocks.push({ kind: "paragraph", runs: parseInline(line) });
    }
  }
  return blocks;
}
