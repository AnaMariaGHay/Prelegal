import { readFileSync } from "node:fs";
import path from "node:path";
import { parseStandardTerms, type Block } from "./standardTerms";

// Server-only: reads the template from the repo-level templates/ directory
// (one level above this Next.js app) when the page is rendered at build time.
export function loadStandardTerms(): Block[] {
  const file = path.join(process.cwd(), "..", "templates", "Mutual-NDA.md");
  return parseStandardTerms(readFileSync(file, "utf8"));
}
