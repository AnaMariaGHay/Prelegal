// Word (.docx) counterpart of DocumentPreview and DocumentPdf, built from the same cover
// page and Standard Terms model, so the user can edit the agreement or send it for redlines.

import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  InternalHyperlink,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from "docx";
import { PARTIES_ANCHOR, type CoverPage, type FieldValue } from "./documents";
import type { Block, Run } from "./standardTerms";

const FONT = "Times New Roman";
const SIZE = 22; // half-points: 11pt, like the PDF

/** Word bookmark names allow letters, digits and underscores only, and must start with a letter. */
function bookmark(anchor: string) {
  return anchor.replace(/\W/g, "_");
}

function valueRun(value: FieldValue) {
  return new TextRun({ text: value.text, highlight: value.missing ? "yellow" : undefined });
}

function runs(items: Run[], anchorFor: (term: string) => string | undefined): ParagraphChild[] {
  return items.map((run) => {
    const anchor = run.term && anchorFor(run.term);
    if (run.href)
      return new ExternalHyperlink({ link: run.href, children: [new TextRun({ text: run.text, bold: run.bold, style: "Hyperlink" })] });
    if (anchor)
      return new InternalHyperlink({ anchor: bookmark(anchor), children: [new TextRun({ text: run.text, bold: run.bold })] });
    return new TextRun({ text: run.text, bold: run.bold });
  });
}

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function cell(children: Paragraph[], width: number) {
  return new TableCell({ children, borders, width: { size: width, type: WidthType.PERCENTAGE }, margins: { top: 60, bottom: 60, left: 100, right: 100 } });
}

function partiesTable(cover: CoverPage) {
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell([new Paragraph("")], 26),
      ...cover.partyHeaders.map((h) => cell([new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true })] })], 37)),
    ],
  });
  const rows = cover.partyRows.map(
    (row) =>
      new TableRow({
        cantSplit: true,
        height: row.label === "Signature" ? { value: 700, rule: "atLeast" } : undefined,
        children: [
          cell(
            [
              new Paragraph({ children: [new TextRun({ text: row.label, bold: true })] }),
              ...(row.hint ? [new Paragraph({ children: [new TextRun({ text: row.hint, italics: true, size: 16, color: "555555" })] })] : []),
            ],
            26,
          ),
          ...row.values.map((v) => cell([new Paragraph({ children: [valueRun(v)] })], 37)),
        ],
      }),
  );
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows] });
}

export function buildDocx(cover: CoverPage, terms: Block[], anchorFor: (term: string) => string | undefined) {
  const coverPage = [
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun(cover.title)] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: cover.coverTitle.toUpperCase(), size: 18, color: "555555" })],
    }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun(cover.intro)] }),
    ...cover.sections.flatMap((section) => [
      new Paragraph({
        keepNext: true,
        spacing: { before: 160 },
        children: [new Bookmark({ id: bookmark(section.anchor), children: [new TextRun({ text: section.title, bold: true })] })],
      }),
      ...section.value.text.split("\n").map((line) => new Paragraph({ children: [valueRun({ ...section.value, text: line })] })),
    ]),
    new Paragraph({
      keepNext: true,
      spacing: { before: 360, after: 120 },
      children: [new Bookmark({ id: bookmark(PARTIES_ANCHOR), children: [new TextRun(cover.signingStatement)] })],
    }),
    partiesTable(cover),
    new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: cover.attribution, size: 16, color: "555555" })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  const standardTerms = terms.map((block) => {
    if (block.kind === "heading")
      return new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun(block.text)] });
    if (block.kind === "clause")
      return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        keepNext: block.level === 0,
        spacing: { before: block.level === 0 ? 200 : 100 },
        indent: { left: block.level * 360 },
        children: [new TextRun(`${block.label} `), ...runs(block.runs, anchorFor)],
      });
    return new Paragraph({ spacing: { before: 120 }, children: runs(block.runs, anchorFor) });
  });

  return new Document({
    creator: "Prelegal",
    title: cover.title,
    styles: {
      default: { document: { run: { font: FONT, size: SIZE } } },
      paragraphStyles: [
        { id: "Title", name: "Title", run: { font: FONT, size: 36, bold: true } },
        { id: "Heading1", name: "Heading 1", run: { font: FONT, size: 30, bold: true }, paragraph: { spacing: { after: 160 } } },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1200, bottom: 1200, left: 1280, right: 1280 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${cover.title} · Page `, size: 16, color: "555555" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "555555" }),
                  new TextRun({ text: " of ", size: 16, color: "555555" }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "555555" }),
                ],
              }),
            ],
          }),
        },
        children: [...coverPage, ...standardTerms],
      },
    ],
  });
}

export function docxBlob(cover: CoverPage, terms: Block[], anchorFor: (term: string) => string | undefined) {
  return Packer.toBlob(buildDocx(cover, terms, anchorFor));
}
