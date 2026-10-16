import Link from "next/link";
import { Suspense } from "react";
import { DraftList } from "@/components/DraftList";
import { getDrafts } from "@/lib/api";
import { requireUser } from "@/lib/session";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">My documents</h1>
        <Link
          href="/documents/new"
          className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
        >
          New document
        </Link>
      </div>
      <Suspense fallback={<p className="mt-6 text-sm text-zinc-600">Loading your documents…</p>}>
        <Documents />
      </Suspense>
    </div>
  );
}

// Reads the session, so it streams in behind the Suspense boundary.
async function Documents() {
  await requireUser();
  let drafts;
  try {
    drafts = await getDrafts();
  } catch (error) {
    console.error(error);
    return (
      <p role="alert" className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
        Your documents couldn’t be loaded. Please refresh the page.
      </p>
    );
  }
  return <DraftList drafts={drafts} />;
}
