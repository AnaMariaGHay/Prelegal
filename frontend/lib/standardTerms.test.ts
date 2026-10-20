import { describe, expect, it } from "vitest";
import { termAnchor } from "./documents";
import { parseInline, parseStandardTerms } from "./standardTerms";
import { loadSpecs, template } from "./test/fixtures";

describe("parseInline", () => {
  it("handles bold, links, autolinks and linked terms", () => {
    expect(
      parseInline(
        'See **Section 1** and [CC BY](https://cc.org) or <https://x.test/a>, per the <span class="coverpage_link">Purpose</span>.',
      ),
    ).toEqual([
      { text: "See " },
      { text: "Section 1", bold: true },
      { text: " and " },
      { text: "CC BY", href: "https://cc.org", bold: false },
      { text: " or " },
      { text: "https://x.test/a", href: "https://x.test/a", bold: false },
      { text: ", per the " },
      { text: "Purpose", term: "Purpose", bold: false },
      { text: "." },
    ]);
  });

  it("keeps linked terms inside bold text", () => {
    const runs = parseInline('**If there are <span class="keyterms_link">Increased Claims</span>, the cap applies.**');
    expect(runs).toEqual([
      { text: "If there are ", bold: true },
      { text: "Increased Claims", term: "Increased Claims", bold: true },
      { text: ", the cap applies.", bold: true },
    ]);
  });

  it("adds https:// to scheme-less link targets", () => {
    expect(parseInline("[site](commonpaper.com/x)")[0].href).toBe("https://commonpaper.com/x");
  });
});

describe("parseStandardTerms", () => {
  it("numbers nested clauses the way the terms cite them", () => {
    const blocks = parseStandardTerms(
      [
        "# Agreement",
        '1. <span class="header_2" id="1">Service</span>',
        '    1. <span class="header_3" id="1.1">Access.</span>  Use it.',
        "    2. Support.",
        "        a. First.",
        "        b. Second.",
        "2. Payment",
        "    1. Fees.",
      ].join("\n"),
    );
    expect(blocks.map((b) => (b.kind === "clause" ? `${b.level}:${b.label}` : b.kind))).toEqual([
      "heading",
      "0:1.",
      "1:1.1",
      "1:1.2",
      "2:(a)",
      "2:(b)",
      "0:2.",
      "1:2.1",
    ]);
    // Section headings become bold text.
    const access = blocks[2];
    expect(access.kind === "clause" && access.runs[0]).toEqual({ text: "Access.", bold: true });
  });

  it.each(loadSpecs().map((s) => s.slug))("parses the %s template cleanly", (slug) => {
    const spec = loadSpecs().find((s) => s.slug === slug)!;
    const blocks = parseStandardTerms(template(slug));
    const runs = blocks.flatMap((b) => ("runs" in b ? b.runs : []));

    expect(blocks.length).toBeGreaterThan(10);
    expect(runs.filter((r) => /<\/?(span|label)|\*\*|\]\(/.test(r.text))).toEqual([]);
    // Every linked term points at its field or the parties table on the cover page.
    expect(runs.filter((r) => r.term && !termAnchor(spec, r.term)).map((r) => r.term)).toEqual([]);
  });
});
