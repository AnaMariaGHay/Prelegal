"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { ui } from "@/lib/ui";

/** Shown when a page fails to render, e.g. if the backend goes down mid-request. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className={`${ui.card} mx-auto mt-6 max-w-md p-6 text-center sm:p-8`}>
      <h1 className="text-lg font-semibold text-zinc-900">Something went wrong</h1>
      <p className={`mt-2 ${ui.muted}`}>
        Prelegal couldn’t load this page. Your saved documents are safe. Please try again in a moment.
      </p>
      {error.digest && <p className="mt-2 text-xs text-zinc-400">Error reference: {error.digest}</p>}
      <div className="mt-6 flex justify-center gap-2">
        <button type="button" onClick={() => retry()} className={ui.primaryButton}>
          Try again
        </button>
        <Link href="/" className={ui.secondaryButton}>
          My documents
        </Link>
      </div>
    </div>
  );
}
