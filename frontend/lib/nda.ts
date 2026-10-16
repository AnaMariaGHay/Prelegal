// Data model for the Mutual NDA cover page, and helpers that turn form data
// into the text shown in the preview and the PDF.

export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
};

export type NdaData = {
  purpose: string;
  effectiveDate: string; // ISO date (YYYY-MM-DD), or "" if not chosen yet
  mndaTerm: { kind: "expires"; years: number } | { kind: "untilTerminated" };
  confidentialityTerm: { kind: "years"; years: number } | { kind: "perpetual" };
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  party1: Party;
  party2: Party;
};

const emptyParty: Party = { name: "", title: "", company: "", noticeAddress: "" };

// Starting point for the chat. The terms default to the template's pre-filled choices
// (templates/Mutual-NDA-coverpage.md), which the assistant confirms with the user; the
// purpose starts blank so the assistant asks about it.
export const defaultNdaData: NdaData = {
  purpose: "",
  effectiveDate: "",
  mndaTerm: { kind: "expires", years: 1 },
  confidentialityTerm: { kind: "years", years: 1 },
  governingLaw: "",
  jurisdiction: "",
  modifications: "",
  party1: emptyParty,
  party2: emptyParty,
};

/** A cover page value: either filled-in text, or a placeholder for a blank field. */
export type FieldValue = { text: string; missing: boolean };

function value(text: string, placeholder: string): FieldValue {
  const trimmed = text.trim();
  return trimmed ? { text: trimmed, missing: false } : { text: `[${placeholder}]`, missing: true };
}

function years(n: number) {
  return `${n} year${n === 1 ? "" : "s"}`;
}

export function formatDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const COVER_PAGE_INTRO =
  "This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“Cover Page”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“Standard Terms”) identical to those posted at commonpaper.com/standards/mutual-nda/1.0. Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.";

export const SIGNING_STATEMENT =
  "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.";

export const ATTRIBUTION =
  "Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under CC BY 4.0.";

/** One line of a cover page section, optionally prefixed by a label like "Governing Law:". */
export type CoverLine = FieldValue & { label?: string };

export type CoverSection = {
  /** Matches the coverpage_link term names used in the Standard Terms. */
  title: string;
  hint?: string;
  lines: CoverLine[];
};

export type PartyRow = { label: string; hint?: string; values: [FieldValue, FieldValue] };

export type CoverPage = { sections: CoverSection[]; partyRows: PartyRow[] };

const blank: FieldValue = { text: "", missing: false };

export function buildCoverPage(data: NdaData): CoverPage {
  const mndaTerm =
    data.mndaTerm.kind === "expires"
      ? `Expires ${years(data.mndaTerm.years)} from Effective Date.`
      : "Continues until terminated in accordance with the terms of the MNDA.";
  const confidentiality =
    data.confidentialityTerm.kind === "years"
      ? `${years(data.confidentialityTerm.years)} from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.`
      : "In perpetuity.";

  const sections: CoverSection[] = [
    { title: "Purpose", hint: "How Confidential Information may be used", lines: [value(data.purpose, "Purpose")] },
    { title: "Effective Date", lines: [value(formatDate(data.effectiveDate), "Effective Date")] },
    { title: "MNDA Term", hint: "The length of this MNDA", lines: [{ text: mndaTerm, missing: false }] },
    {
      title: "Term of Confidentiality",
      hint: "How long Confidential Information is protected",
      lines: [{ text: confidentiality, missing: false }],
    },
    {
      title: "Governing Law & Jurisdiction",
      lines: [
        { label: "Governing Law", ...value(data.governingLaw, "State") },
        { label: "Jurisdiction", ...value(data.jurisdiction, "City or county and state") },
      ],
    },
    {
      title: "MNDA Modifications",
      lines: [data.modifications.trim() ? value(data.modifications, "") : { text: "None.", missing: false }],
    },
  ];

  const row = (label: string, key: keyof Party, placeholder: string, hint?: string): PartyRow => ({
    label,
    hint,
    values: [value(data.party1[key], placeholder), value(data.party2[key], placeholder)],
  });

  const partyRows: PartyRow[] = [
    { label: "Signature", values: [blank, blank] },
    row("Print Name", "name", "Name"),
    row("Title", "title", "Title"),
    row("Company", "company", "Company"),
    row("Notice Address", "noticeAddress", "Email or postal address", "Use either email or postal address"),
    { label: "Date", values: [blank, blank] },
  ];

  return { sections, partyRows };
}

export function pdfFileName(data: NdaData) {
  const slug = (s: string) => s.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const parties = [data.party1.company, data.party2.company].map(slug).filter(Boolean);
  return ["Mutual-NDA", ...parties].join("_") + ".pdf";
}

/** Anchor id of the cover page section that defines a Standard Terms term. */
export function coverAnchor(term: string) {
  const title = term === "Governing Law" || term === "Jurisdiction" ? "Governing Law & Jurisdiction" : term;
  return "cover-" + title.toLowerCase().replace(/[^a-z]+/g, "-");
}
