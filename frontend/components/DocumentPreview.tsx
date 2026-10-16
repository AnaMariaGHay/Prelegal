import { PARTIES_ANCHOR, type CoverPage, type FieldValue } from "@/lib/documents";
import type { Block, Run } from "@/lib/standardTerms";

function Value({ value }: { value: FieldValue }) {
  return value.missing ? <span className="rounded bg-amber-100 px-1 text-amber-800">{value.text}</span> : value.text;
}

function Runs({ runs, anchorFor }: { runs: Run[]; anchorFor: (term: string) => string | undefined }) {
  return runs.map((run, i) => {
    const anchor = run.term && anchorFor(run.term);
    let node: React.ReactNode = run.text;
    if (run.href)
      node = (
        <a href={run.href} target="_blank" rel="noopener noreferrer" className="underline">
          {run.text}
        </a>
      );
    else if (anchor)
      node = (
        <a href={`#${anchor}`} className="text-sky-800 underline decoration-dotted">
          {run.text}
        </a>
      );
    return run.bold ? <strong key={i}>{node}</strong> : <span key={i}>{node}</span>;
  });
}

type Props = { cover: CoverPage; terms: Block[]; anchorFor: (term: string) => string | undefined };

/** Renders the completed document (cover page followed by Standard Terms) as a paper-style page. */
export function DocumentPreview({ cover, terms, anchorFor }: Props) {
  return (
    <article className="mx-auto max-w-[8.5in] bg-white px-6 py-10 font-serif text-[15px] leading-relaxed text-zinc-900 shadow-sm ring-1 ring-zinc-200 sm:px-14">
      <h1 className="text-center text-2xl font-bold">{cover.title}</h1>
      <p className="mt-1 text-center text-sm uppercase tracking-wide text-zinc-500">{cover.coverTitle}</p>
      <p className="mt-6">{cover.intro}</p>

      {cover.sections.map((section) => (
        <section key={section.anchor} id={section.anchor} className="mt-5 scroll-mt-4">
          <h2 className="font-bold">{section.title}</h2>
          <p className="mt-1 whitespace-pre-line">
            <Value value={section.value} />
          </p>
        </section>
      ))}

      <p className="mt-8">{cover.signingStatement}</p>
      <div className="overflow-x-auto">
        <table id={PARTIES_ANCHOR} className="mt-4 w-full min-w-[28rem] scroll-mt-4 table-fixed border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-1/4 border border-zinc-300 p-2" />
              {cover.partyHeaders.map((header) => (
                <th key={header} className="border border-zinc-300 p-2">
                  {header}
                </th>
              ))}
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
      </div>
      <p className="mt-4 text-xs text-zinc-500">{cover.attribution}</p>

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
            <p
              key={i}
              className={`text-justify ${block.level === 0 ? "mt-5" : "mt-2"}`}
              style={{ paddingLeft: `${block.level * 1.5}rem` }}
            >
              {block.label} <Runs runs={block.runs} anchorFor={anchorFor} />
            </p>
          );
        return (
          <p key={i} className="mt-3">
            <Runs runs={block.runs} anchorFor={anchorFor} />
          </p>
        );
      })}
    </article>
  );
}
