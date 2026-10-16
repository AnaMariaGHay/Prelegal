import { Suspense } from "react";
import { BackendDown } from "@/components/BackendDown";
import { DocumentBuilder } from "@/components/DocumentBuilder";
import { getDocuments, getGreeting } from "@/lib/api";
import { requireUser } from "@/lib/session";

export default function NewDocumentPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-600">Loading…</p>}>
      <NewDocument />
    </Suspense>
  );
}

// Reads the session and fetches from the backend at request time, behind the boundary.
async function NewDocument() {
  await requireUser();
  let specs, greeting;
  try {
    [specs, greeting] = await Promise.all([getDocuments(), getGreeting()]);
  } catch (error) {
    console.error(error);
    return <BackendDown />;
  }
  return <DocumentBuilder specs={specs} greeting={greeting} />;
}
