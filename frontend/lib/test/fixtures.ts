// Loads the real document specs and templates, so tests exercise the files the app ships.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DocumentSpec, FieldSpec } from "../documents";

const root = fileURLToPath(new URL("../../../", import.meta.url));

type RawSpec = Omit<DocumentSpec, "fields" | "shortName" | "intro" | "signingStatement"> &
  Partial<Pick<DocumentSpec, "shortName" | "intro" | "signingStatement">> & { fields: Partial<FieldSpec>[] };

/** documents.json with the defaults the backend fills in, as served by /api/documents. */
export function loadSpecs(): DocumentSpec[] {
  const raw: RawSpec[] = JSON.parse(readFileSync(`${root}documents.json`, "utf8"));
  return raw.map((s) => ({
    shortName: null,
    intro: null,
    signingStatement: null,
    ...s,
    fields: s.fields.map((f) => ({ type: "text", default: "", optional: false, aliases: [], ...f }) as FieldSpec),
  }));
}

export function spec(slug: string): DocumentSpec {
  const found = loadSpecs().find((s) => s.slug === slug);
  if (!found) throw new Error(`No spec ${slug}`);
  return found;
}

/** The Standard Terms markdown for a document type. */
export function template(slug: string): string {
  const catalog: { filename: string }[] = JSON.parse(readFileSync(`${root}catalog.json`, "utf8"));
  const entry = catalog.find((e) => e.filename.replace(/\.md$/, "").toLowerCase() === slug);
  if (!entry) throw new Error(`No template for ${slug}`);
  return readFileSync(`${root}templates/${entry.filename}`, "utf8");
}
