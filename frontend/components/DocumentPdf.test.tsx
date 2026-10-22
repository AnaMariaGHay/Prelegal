import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { buildCoverPage, emptyDocument, selectType, termAnchor } from "@/lib/documents";
import { parseStandardTerms } from "@/lib/standardTerms";
import { loadSpecs, template } from "@/lib/test/fixtures";
import { DocumentPdf } from "./DocumentPdf";

// Renders each document type's PDF with the same component the browser uses for downloads.
describe("DocumentPdf", () => {
  it.each(loadSpecs().map((s) => s.slug))("renders the %s PDF", async (slug) => {
    const spec = loadSpecs().find((s) => s.slug === slug)!;
    const cover = buildCoverPage(spec, selectType(emptyDocument, spec));
    const buffer = await renderToBuffer(
      <DocumentPdf cover={cover} terms={parseStandardTerms(template(slug))} anchorFor={(t) => termAnchor(spec, t)} />,
    );
    const pdf = buffer.toString("latin1");
    expect(pdf.startsWith("%PDF-")).toBe(true);
    // A cover page plus the Standard Terms.
    expect(Number(pdf.match(/\/Type \/Pages[\s\S]*?\/Count (\d+)/)?.[1])).toBeGreaterThanOrEqual(2);
  });
});
