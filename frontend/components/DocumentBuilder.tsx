"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  buildCoverPage,
  emptyDocument,
  missingCount,
  pdfFileName,
  selectType,
  termAnchor,
  type DocumentSpec,
  type DocumentState,
} from "@/lib/documents";
import { parseStandardTerms, type Block } from "@/lib/standardTerms";
import { Chat, type ChatMessage } from "./Chat";
import { DocumentPicker } from "./DocumentPicker";
import { DocumentPreview } from "./DocumentPreview";

type Terms = { slug: string; blocks: Block[] } | { slug: string; error: string };

type Props = {
  specs: DocumentSpec[];
  greeting: string;
  /** A saved document to continue. Without one, a new document is saved on the first chat turn. */
  draft?: { id: string; document: DocumentState; messages: ChatMessage[] };
};

export function DocumentBuilder({ specs, greeting, draft }: Props) {
  const router = useRouter();
  const [draftId, setDraftId] = useState(draft?.id ?? null);
  const [doc, setDoc] = useState<DocumentState>(draft?.document ?? emptyDocument);
  // The conversation sent to the backend. The greeting is shown but not sent: the backend
  // already knows it, and the API requires the first message to be from the user.
  const [messages, setMessages] = useState<ChatMessage[]>(draft?.messages ?? []);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const spec = specs.find((s) => s.slug === doc.type) ?? null;

  // Load the Standard Terms whenever a different document is chosen.
  useEffect(() => {
    if (!doc.type || terms?.slug === doc.type) return;
    const slug = doc.type;
    let cancelled = false;
    fetch(`/api/documents/${encodeURIComponent(slug)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`error ${response.status}`))))
      .then((detail: { content: string }) => {
        if (!cancelled) setTerms({ slug, blocks: parseStandardTerms(detail.content) });
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setTerms({ slug, error: "The Standard Terms couldn’t be loaded. Refresh the page to try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [doc.type, terms?.slug]);

  async function sendTurn(history: ChatMessage[], document: DocumentState) {
    setSending(true);
    setChatError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, document, draftId }),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push("/login"); // the session expired
        return;
      }
      if (!response.ok) {
        const detail = typeof body?.detail === "string" ? body.detail : null;
        throw new Error(detail ?? `Something went wrong (error ${response.status}). Please try again.`);
      }
      setMessages([...history, { role: "assistant", content: body.reply }]);
      setDoc(body.document);
      if (body.draftId !== draftId) {
        // The first turn saved a new document: give it its own URL, so a refresh or the
        // back button returns to it.
        setDraftId(body.draftId);
        window.history.replaceState(null, "", `/documents/${body.draftId}`);
      }
    } catch (e) {
      setChatError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function send(text: string, document = doc) {
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    void sendTurn(history, document);
  }

  function choose(chosen: DocumentSpec) {
    const next = selectType(doc, chosen);
    setDoc(next);
    send(`I'd like to create a ${chosen.name}.`, next);
  }

  const cover = spec ? buildCoverPage(spec, doc) : null;
  const anchorFor = (term: string) => (spec ? termAnchor(spec, term) : undefined);
  const blocks = terms && terms.slug === doc.type && "blocks" in terms ? terms.blocks : null;
  const termsError = terms && terms.slug === doc.type && "error" in terms ? terms.error : null;

  async function download() {
    if (!spec || !cover || !blocks) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      // Loaded on demand: react-pdf is large and only needed for the download.
      const [{ pdf }, { DocumentPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./DocumentPdf")]);
      const blob = await pdf(<DocumentPdf cover={cover} terms={blocks} anchorFor={anchorFor} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFileName(spec, doc);
      link.click();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error(e);
      setDownloadError("Sorry, the PDF could not be generated. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  const missing = cover ? missingCount(cover) : 0;

  return (
    <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-6 lg:h-[calc(100vh-9rem)]">
        <Chat
          greeting={greeting}
          messages={messages}
          sending={sending}
          error={chatError}
          onSend={send}
          onRetry={() => sendTurn(messages, doc)}
        />
      </div>

      {!spec || !cover ? (
        <DocumentPicker specs={specs} disabled={sending} onChoose={choose} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 ring-1 ring-zinc-200">
            <p className="text-sm text-zinc-600" aria-live="polite">
              <span className="font-semibold text-zinc-900">{spec.name}</span>
              {" · "}
              {missing === 0
                ? "All required fields are filled in."
                : `${missing} field${missing === 1 ? "" : "s"} still to fill in (highlighted).`}
            </p>
            <div className="flex gap-2">
              <Link
                href="/documents/new"
                className="rounded-md px-3 py-2 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50"
              >
                New document
              </Link>
              <button
                type="button"
                onClick={download}
                disabled={downloading || !blocks}
                className="rounded-md bg-sky-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-800 disabled:opacity-60"
              >
                {downloading ? "Preparing PDF…" : "Download PDF"}
              </button>
            </div>
            {downloadError && <p className="w-full text-sm text-red-700">{downloadError}</p>}
          </div>
          <div className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
            {termsError ? (
              <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-200">
                {termsError}
              </p>
            ) : blocks ? (
              <DocumentPreview cover={cover} terms={blocks} anchorFor={anchorFor} />
            ) : (
              <p className="text-sm text-zinc-600" role="status">
                Loading the {spec.name}…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
