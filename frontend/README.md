# Prelegal frontend

A Next.js app that drafts legal agreements from the Common Paper templates. The user
signs up or logs in, then chats with an AI assistant, which works out which document they need (or suggests the
closest supported one), asks about it and fills in its fields. The completed agreement
updates live beside the chat, and the user can download it as a PDF. Until a document is
chosen, the supported documents are listed as quick-start buttons. Documents are saved
to the user's account as they go, and listed on **My documents** to reopen or delete.

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

- Pages: `/` (My documents), `/documents/new`, `/documents/[id]` (reopen a saved
  document), `/login` and `/signup`. Pages that need the user read the session behind a
  `<Suspense>` boundary (`lib/session.ts`) and send anyone logged out to `/login`.
- `app/api/[...path]/route.ts` forwards every `/api/*` request from the browser to the
  backend, passing the session cookie through in both directions. The backend sets and
  checks it; the browser never talks to the backend directly.
- `components/DocumentBuilder.tsx` holds the conversation and the document. Each turn
  posts the history, the current document and the draft id to `/api/chat`. The backend
  asks Claude, saves the result to the user's draft, and returns the reply plus the
  updated document. After the first turn, the URL changes to the new draft's.
- When a document is chosen, the builder loads its Standard Terms from
  `/api/documents/[slug]`, and `lib/standardTerms.ts` parses that markdown into a small
  document model.
- `lib/documents.ts` defines the document data and builds the cover page from the
  document's spec. Blank required fields become highlighted `[placeholders]`.
- `components/DocumentPreview.tsx` (HTML) and `components/DocumentPdf.tsx` (react-pdf)
  both render that same model. The PDF code loads only when the user clicks
  **Download PDF**.

Templates are from [Common Paper](https://github.com/CommonPaper) under CC BY 4.0. See
`../templates/LICENSE.txt`.
