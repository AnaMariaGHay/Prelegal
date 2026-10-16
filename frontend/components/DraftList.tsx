"use client";

import Link from "next/link";
import { useState } from "react";
import type { DraftSummary } from "@/lib/api";

/** The user's documents, with links to continue them and a delete button each. */
export function DraftList({ drafts: initial }: { drafts: DraftSummary[] }) {
  const [drafts, setDrafts] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function remove(draft: DraftSummary) {
    if (!window.confirm(`Delete “${draft.title}”? This can’t be undone.`)) return;
    setError(null);
    const response = await fetch(`/api/drafts/${encodeURIComponent(draft.id)}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok || response?.status === 404) setDrafts((ds) => ds.filter((d) => d.id !== draft.id));
    else setError("The document couldn’t be deleted. Please try again.");
  }

  if (drafts.length === 0)
    return (
      <div className="mt-6 rounded-lg bg-white p-8 text-center ring-1 ring-zinc-200">
        <p className="font-medium text-zinc-900">You haven’t created any documents yet.</p>
        <p className="mt-1 text-sm text-zinc-600">
          Start a new document and the assistant will guide you through it. Your progress is saved as you go.
        </p>
      </div>
    );

  return (
    <>
      {error && (
        <p role="alert" className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-800 ring-1 ring-red-200">
          {error}
        </p>
      )}
      <ul className="mt-6 divide-y divide-zinc-200 rounded-lg bg-white ring-1 ring-zinc-200">
        {drafts.map((draft) => (
          <li key={draft.id} className="flex items-center gap-3 p-4">
            <Link
              href={`/documents/${draft.id}`}
              className="min-w-0 flex-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
            >
              <span className="block truncate font-medium text-zinc-900 hover:underline">{draft.title}</span>
              <span className="mt-0.5 block text-sm text-zinc-600">
                {status(draft)} · Updated{" "}
                {/* Formatted in the viewer's time zone, which can differ from the server's. */}
                <time dateTime={draft.updatedAt} suppressHydrationWarning>
                  {new Date(draft.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => remove(draft)}
              aria-label={`Delete ${draft.title}`}
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-zinc-300 hover:bg-red-50"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function status(draft: DraftSummary) {
  if (draft.missingCount === null) return "Choosing a document";
  if (draft.missingCount === 0) return "Ready to download";
  return `${draft.missingCount} field${draft.missingCount === 1 ? "" : "s"} to go`;
}
