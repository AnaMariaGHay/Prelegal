import { connection } from "next/server";
import { Suspense } from "react";
import { DocumentBuilder } from "@/components/DocumentBuilder";
import { getDocuments, getGreeting } from "@/lib/api";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-baseline gap-3 px-4 py-4 sm:px-6">
          <span className="text-lg font-bold text-zinc-900">Prelegal</span>
          <h1 className="text-sm text-zinc-600">Draft legal agreements with AI</h1>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        <Suspense fallback={<p className="text-sm text-zinc-600">Loading…</p>}>
          <Builder />
        </Suspense>
      </main>
    </div>
  );
}

// Fetches the supported documents and the chat greeting from the backend at request time,
// streamed in behind the Suspense fallback.
async function Builder() {
  await connection(); // fetch per request, never during the build
  let specs: Awaited<ReturnType<typeof getDocuments>>;
  let greeting: string;
  try {
    [specs, greeting] = await Promise.all([getDocuments(), getGreeting()]);
  } catch (error) {
    console.error(error);
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
        Prelegal couldn’t load its documents because the backend isn’t reachable. Start it with{" "}
        <code>scripts/start</code> and refresh the page.
      </p>
    );
  }
  return <DocumentBuilder specs={specs} greeting={greeting} />;
}
