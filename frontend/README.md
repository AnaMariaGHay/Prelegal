# Prelegal frontend

A Next.js app that drafts legal agreements from the Common Paper templates. The user
chats with an AI assistant, which works out which document they need (or suggests the
closest supported one), asks about it and fills in its fields. The completed agreement
updates live beside the chat, and the user can download it as a PDF. Until a document is
chosen, the supported documents are listed as quick-start buttons.

## Running locally

The easiest way is `scripts/start.sh` (or `scripts\start.ps1`) from the repo root, which
starts this app together with the backend it needs. See the root README.

To run the frontend on its own (Node.js 20.9 or later), the backend must already be
running:

```bash
cd frontend
npm install
npm run dev
```

The backend is expected at `http://127.0.0.1:8000`. Set `PRELEGAL_API_URL` to use a
different address. If it isn't reachable, the page shows an error message instead of the
chat.

Other scripts: `npm run build` (production build, doesn't need the backend),
`npm start` (serve the build) and `npm run lint`.

## How it works

- `app/page.tsx` fetches the supported documents and the chat greeting from the backend
  (`lib/api.ts`) on each request and streams them in behind a loading message.
- `components/DocumentBuilder.tsx` holds the conversation and the document. Each turn
  posts the history and the current document to `app/api/chat/route.ts`, which forwards
  it to the backend. The backend asks Claude and returns the reply plus the updated
  document, which may now be a different document type.
- When a document is chosen, the builder loads its Standard Terms through
  `app/api/documents/[slug]/route.ts`, and `lib/standardTerms.ts` parses that markdown
  into a small document model.
- `lib/documents.ts` defines the document data and builds the cover page from the
  document's spec. Blank required fields become highlighted `[placeholders]`.
- `components/DocumentPreview.tsx` (HTML) and `components/DocumentPdf.tsx` (react-pdf)
  both render that same model. The PDF code loads only when the user clicks
  **Download PDF**.

Templates are from [Common Paper](https://github.com/CommonPaper) under CC BY 4.0. See
`../templates/LICENSE.txt`.
