import {
  ATTRIBUTION,
  COVER_PAGE_INTRO,
  SIGNING_STATEMENT,
  coverAnchor,
  type CoverPage,
  type FieldValue,
} from "@/lib/nda";
import type { Block, Run } from "@/lib/standardTerms";

function Value({ value }: { value: FieldValue }) {
  return value.missing ? <span className="rounded bg-amber-100 px-1 text-amber-800">{value.text}</span> : value.text;
}

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((run, i) => {
    if (run.bold) return <strong key={i}>{run.text}</strong>;
    if (run.href)
      return (
        <a key={i} href={run.href} target="_blank" rel="noopener noreferrer" className="underline">
          {run.text}
        </a>
      );
    if (run.coverPageTerm)
      return (
        <a key={i} href={`#${coverAnchor(run.text)}`} className="text-sky-800 underline decoration-dotted">
          {run.text}
        </a>
      );
    return run.text;
  });
}

/** Renders the completed MNDA (cover page followed by Standard Terms) as a paper-style document. */
export function NdaPreview({ cover, terms }: { cover: CoverPage; terms: Block[] }) {
  return (
    <article className="mx-auto max-w-[8.5in] bg-white px-8 py-10 font-serif text-[15px] leading-relaxed text-zinc-900 shadow-sm ring-1 ring-zinc-200 sm:px-14">
      <h1 className="text-center text-2xl font-bold">Mutual Non-Disclosure Agreement</h1>
      <p className="mt-6">{COVER_PAGE_INTRO}</p>

      {cover.sections.map((section) => (
        <section key={section.title} id={coverAnchor(section.title)} className="mt-6 scroll-mt-4">
          <h2 className="font-bold">{section.title}</h2>
          {section.hint && <p className="text-sm italic text-zinc-500">{section.hint}</p>}
          {section.lines.map((line, i) => (
            <p key={i} className="mt-1 whitespace-pre-line">
              {line.label && `${line.label}: `}
              <Value value={line} />
            </p>
          ))}
        </section>
      ))}

      <p className="mt-8">{SIGNING_STATEMENT}</p>
      <table className="mt-4 w-full table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-1/4 border border-zinc-300 p-2" />
            <th className="border border-zinc-300 p-2">PARTY 1</th>
            <th className="border border-zinc-300 p-2">PARTY 2</th>
          </tr>
        </thead>
        <tbody>
          {cover.partyRows.map((row) => (
            <tr key={row.label}>
              <th className="border border-zinc-300 p-2 text-left align-top font-semibold">
                {row.label}
                {row.hint && <span className="block text-xs font-normal italic text-zinc-500">{row.hint}</span>}
              </th>
              {row.values.map((v, i) => (
                <td key={i} className="h-10 border border-zinc-300 p-2 align-top break-words">
                  <Value value={v} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-zinc-500">{ATTRIBUTION}</p>

      <hr className="my-10 border-zinc-300" />

      {terms.map((block, i) => {
        if (block.kind === "heading")
          return (
            <h2 key={i} className="mb-4 text-center text-xl font-bold">
              {block.text}
            </h2>
          );
        if (block.kind === "clause")
          return (
            <p key={i} className="mt-3 text-justify">
              {block.number}. <Runs runs={block.runs} />
            </p>
          );
        return (
          <p key={i} className="mt-6 text-xs text-zinc-500">
            <Runs runs={block.runs} />
          </p>
        );
      })}
    </article>
  );
}
