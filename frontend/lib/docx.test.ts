import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildCoverPage, emptyDocument, selectType, termAnchor } from "./documents";
import { buildDocx } from "./docx";
import { parseStandardTerms } from "./standardTerms";
import { spec, template } from "./test/fixtures";

/** Builds a .docx for a document type and returns the XML of its body and footer. */
async function render(slug: string, fields: Record<string, string> = {}) {
  const s = spec(slug);
  const blank = selectType(emptyDocument, s);
  const state = {
    ...blank,
    fields: { ...blank.fields, ...fields },
    parties: [{ ...blank.parties[0], company: "Acme Inc." }, blank.parties[1]] as typeof blank.parties,
  };
  const doc = buildDocx(buildCoverPage(s, state), parseStandardTerms(template(slug)), (t) => termAnchor(s, t));
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  return {
    body: await zip.file("word/document.xml")!.async("string"),
    footer: await zip.file("word/footer1.xml")!.async("string"),
  };
}

describe("buildDocx", () => {
  it("writes the cover page, parties and Standard Terms", async () => {
    const { body } = await render("csa", { governing_law: "Delaware" });
    expect(body).toContain("Cloud Service Agreement");
    expect(body).toContain("ORDER FORM");
    expect(body).toContain("Delaware");
    expect(body).toContain("Acme Inc.");
    expect(body).toContain("Access and Use.");
    expect(body).toContain("1.1 ");
  });

  it("highlights placeholders for blank required fields", async () => {
    const { body } = await render("pilot-agreement");
    expect(body).toMatch(/<w:highlight w:val="yellow"\/>[\s\S]*?\[Pilot Period\]/);
  });

  it("links terms in the Standard Terms to bookmarks on the cover page", async () => {
    const { body } = await render("mutual-nda");
    expect(body).toContain('w:name="cover_purpose"');
    expect(body).toContain('w:anchor="cover_purpose"');
    expect(body).toContain('w:name="cover_parties"');
  });

  it("numbers pages in the footer", async () => {
    const { footer } = await render("sla");
    expect(footer).toContain("Service Level Agreement · Page ");
    expect(footer).toContain("NUMPAGES");
  });
});
