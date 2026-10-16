# Prelegal
A platform for drafting common legal agreements

## Status

🚧 **This project is a work in progress.** Completion is targeted for **October 22, 2026** (one week from October 15, 2026).

## Project layout

| Path | What it is |
|---|---|
| `frontend/` | Next.js web app (TypeScript, Tailwind). Currently the Mutual NDA creator. |
| `backend/` | FastAPI service that serves the legal templates from a temporary SQLite database. |
| `templates/` | Common Paper agreement templates in Markdown (CC BY 4.0). |
| `catalog.json` | Name, description and filename of each template. The backend loads it at startup. |
| `scripts/` | Scripts that start and stop the whole app. |

## Running locally

Requirements: [Node.js](https://nodejs.org/) 20.9 or later, Python 3.12 or later and
[uv](https://docs.astral.sh/uv/getting-started/installation/). If uv isn't on your
PATH, the scripts also accept `pip install uv`.

Start both services. On first run this also installs their dependencies:

```bash
scripts/start.sh          # macOS, Linux, Git Bash
```

```powershell
.\scripts\start.ps1       # Windows PowerShell
```

Then open http://localhost:3000. API docs are at http://localhost:8000/docs.

Stop both services:

```bash
scripts/stop.sh
```

```powershell
.\scripts\stop.ps1
```

Logs are written to `.run/`. Set `BACKEND_PORT` or `FRONTEND_PORT` to change the
default ports (8000 and 3000).

## Development

- **Backend tests:** `cd backend && uv run pytest`
- **Frontend checks:** `cd frontend && npm run lint && npm run build`

The database is temporary. It's rebuilt from `catalog.json` and `templates/` every time
the backend starts, so to change a template, edit the files and restart.
