# syntax=docker/dockerfile:1
# Prelegal API. Build from the repo root, since the image also needs templates/ and
# catalog.json:  docker build -f backend/Dockerfile .
FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:0.12 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/backend/.venv/bin:$PATH" \
    # Users and their documents live here. compose.yaml mounts a volume on /data so they
    # survive restarts and rebuilds.
    PRELEGAL_DATABASE_URL="sqlite:////data/prelegal.db"

WORKDIR /app/backend

# Dependencies first, so code changes don't reinstall them.
COPY backend/pyproject.toml backend/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project

COPY templates /app/templates
COPY catalog.json documents.json /app/
COPY backend/alembic.ini ./
COPY backend/migrations ./migrations
COPY backend/app ./app

RUN useradd --system prelegal && mkdir /data && chown prelegal /data
USER prelegal

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
