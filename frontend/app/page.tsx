import { NdaBuilder } from "@/components/NdaBuilder";
import { loadStandardTerms } from "@/lib/loadStandardTerms";

export default function Home() {
  const terms = loadStandardTerms();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-100">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-baseline gap-3 px-4 py-4 sm:px-6">
          <span className="text-lg font-bold text-zinc-900">Prelegal</span>
          <h1 className="text-sm text-zinc-600">Mutual NDA creator</h1>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        <NdaBuilder terms={terms} />
      </main>
    </div>
  );
}
