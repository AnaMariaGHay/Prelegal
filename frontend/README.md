# Prelegal frontend: Mutual NDA creator

A Next.js app that creates a Mutual Non-Disclosure Agreement from the Common Paper
Mutual NDA template. The user fills in a form, sees the completed agreement update
live, and downloads it as a PDF.

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
form.

Other scripts: `npm run build` (production build, doesn't need the backend),
`npm start` (serve the build) and `npm run lint`.

## How it works

- `app/page.tsx` fetches the Standard Terms from the backend (`lib/api.ts`) on each
  request and streams them in behind a loading message.
- `lib/standardTerms.ts` parses that markdown into a small document model.
- `lib/nda.ts` defines the form data and builds the cover page from it. Blank fields
  become highlighted `[placeholders]`.
- `components/NdaPreview.tsx` (HTML) and `components/NdaPdf.tsx` (react-pdf) both render
  that same model. The PDF code loads only when the user clicks **Download PDF**.

Templates are from [Common Paper](https://github.com/CommonPaper) under CC BY 4.0. See
`../templates/LICENSE.txt`.
