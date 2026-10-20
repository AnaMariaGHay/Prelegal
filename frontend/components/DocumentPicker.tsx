import type { DocumentSpec } from "@/lib/documents";
import { ui } from "@/lib/ui";

type Props = { specs: DocumentSpec[]; disabled: boolean; onChoose: (spec: DocumentSpec) => void };

/** The supported documents, as quick-start buttons shown until a document is chosen. */
export function DocumentPicker({ specs, disabled, onChoose }: Props) {
  return (
    <section aria-labelledby="picker-heading" className={`${ui.card} p-5 sm:p-6`}>
      <h2 id="picker-heading" className="text-lg font-semibold text-zinc-900">
        Choose a document
      </h2>
      <p className={`mt-1 ${ui.muted}`}>Or describe what you need in the chat, and the assistant will suggest one.</p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {specs.map((spec) => (
          <li key={spec.slug}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChoose(spec)}
              className="h-full w-full rounded-md border border-zinc-200 p-4 text-left hover:border-sky-600 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 disabled:opacity-60"
            >
              <span className="block font-semibold text-zinc-900">{spec.name}</span>
              <span className="mt-1 block text-sm text-zinc-600">{spec.summary}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
