# Prelegal
A platform for drafting common legal agreements

## Status

🚧 **This project is a work in progress.** Completion is targeted for **October 22, 2026** (one week from October 15, 2026).

## Project layout

| Path | What it is |
|---|---|
| `frontend/` | Next.js web app (TypeScript, Tailwind): an AI chat that drafts any supported agreement, beside a live preview of the document. |
| `backend/` | FastAPI service: user accounts, saved documents, the legal templates and the AI chat (through the Claude API). Data is stored in SQLite, with Alembic migrations in `backend/migrations/`. |
| `templates/` | Common Paper agreement templates in Markdown (CC BY 4.0). |
| `catalog.json` | Name, description and filename of each template. The backend loads it at startup. |
| `documents.json` | The supported document types: each one's party roles and the fields on its cover page, with help text the AI uses when asking about them. |
| `scripts/` | Scripts that start and stop the whole app. |

## Running locally

Requirements: [Node.js](https://nodejs.org/) 20.9 or later, Python 3.12 or later and
[uv](https://docs.astral.sh/uv/getting-started/installation/). If uv isn't on your
PATH, the scripts also accept `pip install uv`.

The document creator is an AI chat powered by Claude, so the backend needs an
Anthropic API key. Copy `backend/.env.example` to `backend/.env` and set
`ANTHROPIC_API_KEY`. The `.env` file is git-ignored. Restart the backend after changing it.

Start both services. On first run this also installs their dependencies:

```bash
scripts/start.sh          # macOS, Linux, Git Bash
```

```powershell
.\scripts\start.ps1       # Windows PowerShell
```

Then open http://localhost:3000, create an account and start a document. API docs are at
http://localhost:8000/docs.

Stop both services:

```bash
scripts/stop.sh
```

```powershell
.\scripts\stop.ps1
```

Logs are written to `.run/`. Set `BACKEND_PORT` or `FRONTEND_PORT` to change the
default ports (8000 and 3000).

## Running with Docker

Requirements: [Docker](https://docs.docker.com/get-docker/) with Compose, and
`backend/.env` set up as above. The key is passed to the backend container when it
starts and is never built into an image.

```bash
docker compose up --build -d   # build and start both services
docker compose logs -f         # follow the logs
docker compose down            # stop
```

Then open http://localhost:3000. API docs are at http://localhost:8000/docs (only
reachable from your machine). `BACKEND_PORT` and `FRONTEND_PORT` change the ports here
too. Stop the local scripts first, since both use the same ports. Run
`docker compose up --build -d` again after changing code or templates.

Accounts and documents are stored in the `prelegal-data` Docker volume, so they survive
`docker compose down` and rebuilds. `docker compose down -v` deletes the volume and
everything in it.

## Development

- **Backend tests:** `cd backend && uv run pytest`
- **Frontend checks:** `cd frontend && npm run lint && npm run build`

## Accounts and data

- Users sign up with an email and password (at least 8 characters). Passwords are hashed
  with Argon2. Logging in creates a server-side session, kept in an httpOnly cookie for
  30 days (`PRELEGAL_SESSION_DAYS`). Logging out ends it on the server.
- Each user sees only their own documents. A document is saved on its first chat turn
  and after every turn after that, together with its conversation, so it can be reopened
  and continued from **My documents**.
- The database is a SQLite file, `backend/data/prelegal.db` (git-ignored). Set
  `PRELEGAL_DATABASE_URL` to use another database, e.g. Postgres, with its driver
  installed.
- The backend applies any pending migrations on startup. After changing
  `backend/app/models.py`, create a migration with
  `cd backend && uv run alembic revision --autogenerate -m "describe the change"`, and
  review it before committing.
- When serving over HTTPS, set `PRELEGAL_SECURE_COOKIES=true` so the session cookie is
  never sent over plain HTTP.

Templates are not stored as user data: the templates table is reloaded from
`catalog.json` and `templates/` every time the backend starts, so to change a template,
edit the files and restart.

To change a document's cover page fields, edit `documents.json` and restart the backend.
The backend tests check that every term a template links to its cover page (such as
"Subscription Period") has a matching field or party role.
