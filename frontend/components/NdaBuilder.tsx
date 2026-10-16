"use client";

import { useState } from "react";
import { buildCoverPage, defaultNdaData, pdfFileName } from "@/lib/nda";
import type { Block } from "@/lib/standardTerms";
import { NdaChat } from "./NdaChat";
import { NdaPreview } from "./NdaPreview";

export function NdaBuilder({ terms, greeting }: { terms: Block[]; greeting: string }) {
  const [data, setData] = useState(defaultNdaData);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cover = buildCoverPage(data);
  const missingCount = [...cover.sections.flatMap((s) => s.lines), ...cover.partyRows.flatMap((r) => r.values)].filter(
    (v) => v.missing,
  ).length;

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      // Loaded on demand: react-pdf is large and only needed for the download.
      const [{ pdf }, { NdaPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./NdaPdf")]);
      const blob = await pdf(<NdaPdf cover={cover} terms={terms} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFileName(data);
      link.click();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error(e);
      setError("Sorry, the PDF could not be generated. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-9rem)]">
        <NdaChat greeting={greeting} data={data} onDocumentChange={setData} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-600" aria-live="polite">
            {missingCount === 0
              ? "All fields are filled in."
              : `${missingCount} field${missingCount === 1 ? "" : "s"} still to fill in (highlighted).`}
          </p>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800 disabled:opacity-60"
          >
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </button>
          {error && <p className="w-full text-sm text-red-700">{error}</p>}
        </div>
        <div className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
          <NdaPreview cover={cover} terms={terms} />
        </div>
      </div>
    </div>
  );
}
