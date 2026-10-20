import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DraftList } from "@/components/DraftList";
import { getDrafts } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { ui } from "@/lib/ui";

// The title template in the root layout only applies to nested pages, so spell it out here.
export const metadata: Metadata = { title: { absolute: "My documents · Prelegal" } };

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">My documents</h1>
        <Link
          href="/documents/new"
          className={ui.primaryButton}
        >
          New document
        </Link>
      </div>
      <Suspense fallback={<p className={`mt-6 ${ui.muted}`}>Loading your documents…</p>}>
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
      <p role="alert" className={`${ui.errorBox} mt-6`}>
        Your documents couldn’t be loaded. Please refresh the page.
      </p>
    );
  }
  return <DraftList drafts={drafts} />;
}
