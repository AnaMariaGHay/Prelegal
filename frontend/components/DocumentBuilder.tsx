"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  buildCoverPage,
  emptyDocument,
  missingCount,
  downloadFileName,
  selectType,
  termAnchor,
  type DocumentSpec,
  type DocumentState,
} from "@/lib/documents";
import { parseStandardTerms, type Block } from "@/lib/standardTerms";
import { ui } from "@/lib/ui";
import { Chat, type ChatMessage } from "./Chat";
import { DocumentPicker } from "./DocumentPicker";
import { DocumentPreview } from "./DocumentPreview";

type Format = "pdf" | "docx";

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
  const [downloading, setDownloading] = useState<Format | null>(null);
  const [view, setView] = useState<"chat" | "document">("chat");
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

  async function download(format: Format) {
    if (!spec || !cover || !blocks) return;
    setDownloading(format);
    setDownloadError(null);
    try {
      // Loaded on demand: the PDF and Word libraries are large and only needed here.
      let blob: Blob;
      if (format === "pdf") {
        const [{ pdf }, { DocumentPdf }] = await Promise.all([import("@react-pdf/renderer"), import("./DocumentPdf")]);
        blob = await pdf(<DocumentPdf cover={cover} terms={blocks} anchorFor={anchorFor} />).toBlob();
      } else {
        const { docxBlob } = await import("@/lib/docx");
        blob = await docxBlob(cover, blocks, anchorFor);
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = downloadFileName(spec, doc, format);
      link.click();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error(e);
      setDownloadError(`Sorry, the ${format === "pdf" ? "PDF" : "Word document"} could not be generated. Please try again.`);
    } finally {
      setDownloading(null);
    }
  }

  const missing = cover ? missingCount(cover) : 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* On small screens the chat and the document take turns; on large ones they sit side by side. */}
      <div role="tablist" aria-label="View" className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-200 p-1 lg:hidden">
        {(["chat", "document"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === v ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"}`}
          >
            {v === "chat" ? "Chat" : spec ? `Document${missing ? ` (${missing} to go)` : " ✓"}` : "Documents"}
          </button>
        ))}
      </div>

      <div className="grid flex-1 gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className={`${view === "chat" ? "" : "hidden"} h-[calc(100dvh-12rem)] lg:sticky lg:top-6 lg:block lg:h-[calc(100vh-9rem)]`}>
          <Chat
            greeting={greeting}
            messages={messages}
            sending={sending}
            error={chatError}
            onSend={send}
            onRetry={() => sendTurn(messages, doc)}
          />
        </div>

        <div className={`${view === "document" ? "" : "hidden"} lg:block`}>
          {!spec || !cover ? (
            <DocumentPicker
              specs={specs}
              disabled={sending}
              onChoose={(chosen) => {
                choose(chosen);
                setView("chat");
              }}
            />
          ) : (
            <div className="space-y-4">
              <div className={`${ui.card} flex flex-wrap items-center justify-between gap-3 p-3`}>
                <p className={ui.muted} aria-live="polite">
                  <span className="font-semibold text-zinc-900">{spec.name}</span>
                  {" · "}
                  {missing === 0
                    ? "All required fields are filled in."
                    : `${missing} field${missing === 1 ? "" : "s"} still to fill in (highlighted).`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/documents/new" className={ui.secondaryButton}>
                    New document
                  </Link>
                  <button
                    type="button"
                    onClick={() => download("docx")}
                    disabled={downloading !== null || !blocks}
                    className={ui.secondaryButton}
                  >
                    {downloading === "docx" ? "Preparing…" : "Download Word"}
                  </button>
                  <button
                    type="button"
                    onClick={() => download("pdf")}
                    disabled={downloading !== null || !blocks}
                    className={ui.primaryButton}
                  >
                    {downloading === "pdf" ? "Preparing…" : "Download PDF"}
                  </button>
                </div>
                {downloadError && (
                  <p role="alert" className="w-full text-sm text-red-700">
                    {downloadError}
                  </p>
                )}
              </div>
              <div className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
                {termsError ? (
                  <p role="alert" className={ui.errorBox}>
                    {termsError}
                  </p>
                ) : blocks ? (
                  <DocumentPreview cover={cover} terms={blocks} anchorFor={anchorFor} />
                ) : (
                  <p className={ui.muted} role="status">
                    Loading the {spec.name}…
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
