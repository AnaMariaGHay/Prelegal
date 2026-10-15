// Parses the Common Paper Standard Terms markdown into a small document model
// that both the HTML preview and the PDF can render.
//
// The template only uses a handful of constructs, so this is deliberately not a
// general markdown parser: "# " headings, numbered clauses ("1. ..."), plain
// paragraphs, and inline **bold**, [links](url) and
// <span class="coverpage_link">Term</span> references to cover page fields.

export type Run = {
  text: string;
  bold?: boolean;
  href?: string;
  /** A defined term whose value is set on the cover page, e.g. "Purpose". */
  coverPageTerm?: boolean;
};

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "clause"; number: string; runs: Run[] }
  | { kind: "paragraph"; runs: Run[] };

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)]+)\)|<span class="coverpage_link">(.+?)<\/span>/g;

export function parseInline(text: string): Run[] {
  const runs: Run[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) runs.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) runs.push({ text: m[2], href: m[3] });
    else runs.push({ text: m[4], coverPageTerm: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs;
}

export function parseStandardTerms(markdown: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^#+\s+(.*)$/);
    const clause = line.match(/^(\d+)\.\s+(.*)$/);
    if (heading) blocks.push({ kind: "heading", text: heading[1] });
    else if (clause) blocks.push({ kind: "clause", number: clause[1], runs: parseInline(clause[2]) });
    else blocks.push({ kind: "paragraph", runs: parseInline(line) });
  }
  return blocks;
}
