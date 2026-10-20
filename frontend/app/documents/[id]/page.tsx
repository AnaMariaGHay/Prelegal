import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackendDown } from "@/components/BackendDown";
import { DocumentBuilder } from "@/components/DocumentBuilder";
import { getDocuments, getDraft, getGreeting } from "@/lib/api";
import { requireUser } from "@/lib/session";

export default function DraftPage({ params }: PageProps<"/documents/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-600">Loading your document…</p>}>
      <SavedDocument params={params} />
    </Suspense>
  );
}

// Reopens one of the user's documents, with its conversation, to continue where they left off.
async function SavedDocument({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  let draft, specs, greeting;
  try {
    [draft, specs, greeting] = await Promise.all([getDraft(id), getDocuments(), getGreeting()]);
  } catch (error) {
    console.error(error);
    return <BackendDown />;
  }
  if (!draft) notFound();
  return <DocumentBuilder key={draft.id} specs={specs} greeting={greeting} draft={draft} />;
}
