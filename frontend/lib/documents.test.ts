import { describe, expect, it } from "vitest";
import {
  PARTIES_ANCHOR,
  buildCoverPage,
  downloadFileName,
  emptyDocument,
  fieldAnchor,
  missingCount,
  selectType,
  termAnchor,
  type DocumentState,
} from "./documents";
import { spec } from "./test/fixtures";

const nda = spec("mutual-nda");

function withFields(state: DocumentState, fields: Record<string, string>): DocumentState {
  return { ...state, fields: { ...state.fields, ...fields } };
}

function withCompanies(state: DocumentState, first: string, second = ""): DocumentState {
  return {
    ...state,
    parties: [
      { ...state.parties[0], company: first },
      { ...state.parties[1], company: second },
    ],
  };
}

describe("selectType", () => {
  it("starts at the template defaults and carries shared values and parties over", () => {
    const first = selectType(emptyDocument, nda);
    expect(first.type).toBe("mutual-nda");
    expect(first.fields.mnda_term).toBe("Expires 1 year from Effective Date.");

    const csa = selectType(withCompanies(withFields(first, { governing_law: "Delaware" }), "Acme"), spec("csa"));
    expect(csa.fields.governing_law).toBe("Delaware");
    expect(csa.fields).not.toHaveProperty("mnda_term");
    expect(csa.parties[0].company).toBe("Acme");
  });
});

describe("buildCoverPage", () => {
  it("highlights blank required fields and shows None for blank optional ones", () => {
    const cover = buildCoverPage(nda, selectType(emptyDocument, nda));
    const section = (title: string) => cover.sections.find((s) => s.title === title)!.value;

    expect(section("Purpose")).toEqual({ text: "[Purpose]", missing: true });
    expect(section("MNDA Modifications")).toEqual({ text: "None.", missing: false });
    expect(section("MNDA Term").missing).toBe(false); // has a default
    expect(cover.partyHeaders).toEqual(["PARTY 1", "PARTY 2"]);
    // Purpose, Effective Date, Governing Law, Jurisdiction, and 4 details for each party.
    expect(missingCount(cover)).toBe(12);
  });

  it("formats dates and uses the spec's own intro when it has one", () => {
    const cover = buildCoverPage(nda, withFields(selectType(emptyDocument, nda), { effective_date: "2026-10-16" }));
    expect(cover.sections.find((s) => s.title === "Effective Date")!.value.text).toBe("October 16, 2026");
    expect(cover.intro).toMatch(/^This Mutual Non-Disclosure Agreement \(the “MNDA”\)/);
  });

  it("writes a generic intro and signing statement from the spec", () => {
    const csa = spec("csa");
    const cover = buildCoverPage(csa, selectType(emptyDocument, csa));
    expect(cover.intro).toContain("(1) this Order Form");
    expect(cover.signingStatement).toBe(
      "By signing this Order Form, each party agrees to enter into this Cloud Service Agreement as of the Effective Date.",
    );
    expect(cover.partyHeaders).toEqual(["PROVIDER", "CUSTOMER"]);

    const sla = spec("sla"); // has no effective date field
    expect(buildCoverPage(sla, selectType(emptyDocument, sla)).signingStatement).toMatch(
      /as of the date of the last signature below\.$/,
    );
  });
});

describe("termAnchor", () => {
  const csa = spec("csa");
  it.each([
    ["Subscription Period", fieldAnchor("subscription_period")],
    ["Subscription Periods", fieldAnchor("subscription_period")], // alias
    ["Customer’s", PARTIES_ANCHOR], // possessive party role
    ["Provider", PARTIES_ANCHOR],
    ["Unknown Term", undefined],
  ])("%s", (term, anchor) => {
    expect(termAnchor(csa, term)).toBe(anchor);
  });
});

describe("downloadFileName", () => {
  it("uses the short name and party companies", () => {
    const state = withCompanies(selectType(emptyDocument, nda), "Acme, Inc.", "Globex");
    expect(downloadFileName(nda, state, "pdf")).toBe("Mutual-NDA_Acme-Inc_Globex.pdf");
    const csa = spec("csa");
    expect(downloadFileName(csa, selectType(emptyDocument, csa), "docx")).toBe("Cloud-Service-Agreement.docx");
  });
});
