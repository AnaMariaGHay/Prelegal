// Data model for a document being drafted, and helpers that turn it into the cover page
// shown in the preview and the PDF. Mirrors backend/app/documents.py.

export type FieldSpec = {
  key: string;
  label: string;
  type: "text" | "longtext" | "date";
  help: string;
  default: string;
  optional: boolean;
  /** Other spellings of the label used in the Standard Terms, e.g. plurals. */
  aliases: string[];
};

/** A supported document type, from documents.json via the backend. */
export type DocumentSpec = {
  slug: string;
  name: string;
  shortName: string | null;
  summary: string;
  coverTitle: string;
  parties: [string, string];
  fields: FieldSpec[];
  intro: string | null;
  signingStatement: string | null;
  attribution: string;
};

export type Party = {
  company: string;
  name: string;
  title: string;
  noticeAddress: string;
};

export type DocumentState = {
  /** The chosen document's slug, or null before the user has chosen one. */
  type: string | null;
  fields: Record<string, string>;
  parties: [Party, Party];
};

const emptyParty: Party = { company: "", name: "", title: "", noticeAddress: "" };

export const emptyDocument: DocumentState = { type: null, fields: {}, parties: [emptyParty, emptyParty] };

/**
 * Switches to another document type, like select_type in the backend: shared field values
 * and the party details carry over, and other fields start at the template's defaults.
 */
export function selectType(state: DocumentState, spec: DocumentSpec): DocumentState {
  const fields = Object.fromEntries(spec.fields.map((f) => [f.key, state.fields[f.key] || f.default]));
  return { type: spec.slug, fields, parties: state.parties };
}

/** A cover page value: either filled-in text, or a placeholder for a blank field. */
export type FieldValue = { text: string; missing: boolean };

function value(text: string, placeholder: string): FieldValue {
  const trimmed = text.trim();
  return trimmed ? { text: trimmed, missing: false } : { text: `[${placeholder}]`, missing: true };
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

export type CoverSection = { anchor: string; title: string; value: FieldValue };

export type PartyRow = { label: string; hint?: string; values: [FieldValue, FieldValue] };

export type CoverPage = {
  title: string;
  coverTitle: string;
  intro: string;
  sections: CoverSection[];
  partyHeaders: [string, string];
  partyRows: PartyRow[];
  signingStatement: string;
  attribution: string;
};

const blank: FieldValue = { text: "", missing: false };

export const PARTIES_ANCHOR = "cover-parties";

export function fieldAnchor(key: string) {
  return `cover-${key}`;
}

export function buildCoverPage(spec: DocumentSpec, state: DocumentState): CoverPage {
  const sections = spec.fields.map((field) => {
    const raw = state.fields[field.key] ?? "";
    const text = field.type === "date" ? formatDate(raw) : raw;
    return {
      anchor: fieldAnchor(field.key),
      title: field.label,
      value: field.optional && !text.trim() ? { text: "None.", missing: false } : value(text, field.label),
    };
  });

  const dateTerm = spec.fields.find((f) => f.key === "effective_date" || f.key === "baa_effective_date")?.label;
  const row = (label: string, key: keyof Party, placeholder: string, hint?: string): PartyRow => ({
    label,
    hint,
    values: [value(state.parties[0][key], placeholder), value(state.parties[1][key], placeholder)],
  });

  return {
    title: spec.name,
    coverTitle: spec.coverTitle,
    intro:
      spec.intro ??
      `This ${spec.name} consists of: (1) this ${spec.coverTitle} and (2) the Common Paper Standard Terms set out below (“Standard Terms”). Any modifications of the Standard Terms should be made on this ${spec.coverTitle}, which will control over conflicts with the Standard Terms.`,
    sections,
    partyHeaders: [spec.parties[0].toUpperCase(), spec.parties[1].toUpperCase()] as [string, string],
    partyRows: [
      { label: "Signature", values: [blank, blank] },
      row("Print Name", "name", "Name"),
      row("Title", "title", "Title"),
      row("Company", "company", "Company"),
      row("Notice Address", "noticeAddress", "Email or postal address", "Use either email or postal address"),
      { label: "Date", values: [blank, blank] },
    ],
    signingStatement:
      spec.signingStatement ??
      `By signing this ${spec.coverTitle}, each party agrees to enter into this ${spec.shortName ?? spec.name} ${
        dateTerm ? `as of the ${dateTerm}` : "as of the date of the last signature below"
      }.`,
    attribution: spec.attribution,
  };
}

/** Number of required values still blank on the cover page. */
export function missingCount(cover: CoverPage) {
  return [...cover.sections.map((s) => s.value), ...cover.partyRows.flatMap((r) => r.values)].filter((v) => v.missing)
    .length;
}

/** E.g. "Mutual-NDA_Acme-Inc_Globex-Corp.pdf". */
export function downloadFileName(spec: DocumentSpec, state: DocumentState, extension: "pdf" | "docx") {
  const slug = (s: string) => s.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const parties = state.parties.map((p) => slug(p.company)).filter(Boolean);
  return `${[slug(spec.shortName ?? spec.name), ...parties].join("_")}.${extension}`;
}

/**
 * Anchor of the cover page entry that defines a term linked from the Standard Terms, e.g.
 * "Subscription Periods" -> the Subscription Period field, "Customer's" -> the parties table.
 */
export function termAnchor(spec: DocumentSpec, term: string): string | undefined {
  const base = term.replace(/[’']s$/, "");
  if (spec.parties.includes(base) || base === "Notice Address") return PARTIES_ANCHOR;
  const field = spec.fields.find((f) => f.label === base || f.aliases.includes(base));
  return field && fieldAnchor(field.key);
}
