# Prelegal frontend: Mutual NDA creator (prototype)

A Next.js app that creates a Mutual Non-Disclosure Agreement from the Common Paper
Mutual NDA template. The user fills in a form, sees the completed agreement update
live, and downloads it as a PDF.

## Running locally

Requires Node.js 20.9 or later.

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000.

Other scripts: `npm run build` (production build), `npm start` (serve the build) and
`npm run lint`.

## How it works

- `app/page.tsx` loads the Standard Terms from `../templates/Mutual-NDA.md` at build
  time. Run the scripts from the `frontend/` directory so this path resolves.
- `lib/standardTerms.ts` parses that markdown into a small document model.
- `lib/nda.ts` defines the form data and builds the cover page from it. Blank fields
  become highlighted `[placeholders]`.
- `components/NdaPreview.tsx` (HTML) and `components/NdaPdf.tsx` (react-pdf) both render
  that same model. The PDF code loads only when the user clicks **Download PDF**.

Templates are from [Common Paper](https://github.com/CommonPaper) under CC BY 4.0. See
`../templates/LICENSE.txt`.
