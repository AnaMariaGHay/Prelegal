#!/usr/bin/env bash
# Start the Prelegal backend (FastAPI) and frontend (Next.js) in the background.
# Works on macOS, Linux and Git Bash on Windows. Stop them with scripts/stop.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
mkdir -p "$RUN_DIR"

# Use uv from PATH, or fall back to the Python module (pip install uv).
if command -v uv >/dev/null 2>&1; then
  UV=(uv)
elif python -m uv --version >/dev/null 2>&1; then
  UV=(python -m uv)
elif python3 -m uv --version >/dev/null 2>&1; then
  UV=(python3 -m uv)
else
  echo "uv is required: https://docs.astral.sh/uv/getting-started/installation/" >&2
  exit 1
fi

is_running() { [ -f "$RUN_DIR/$1.pid" ] && kill -0 "$(cat "$RUN_DIR/$1.pid")" 2>/dev/null; }

if is_running backend || is_running frontend; then
  echo "Prelegal is already running. Use scripts/stop.sh first." >&2
  exit 1
fi

echo "Installing dependencies..."
"${UV[@]}" --directory "$ROOT/backend" sync --quiet
[ -d "$ROOT/frontend/node_modules" ] || npm --prefix "$ROOT/frontend" install --silent

echo "Starting backend on http://localhost:$BACKEND_PORT ..."
nohup "${UV[@]}" --directory "$ROOT/backend" run uvicorn app.main:app --reload --port "$BACKEND_PORT" \
  >"$RUN_DIR/backend.log" 2>&1 &
echo $! >"$RUN_DIR/backend.pid"

echo "Starting frontend on http://localhost:$FRONTEND_PORT ..."
PRELEGAL_API_URL="http://127.0.0.1:$BACKEND_PORT" nohup npm --prefix "$ROOT/frontend" run dev -- --port "$FRONTEND_PORT" \
  >"$RUN_DIR/frontend.log" 2>&1 &
echo $! >"$RUN_DIR/frontend.pid"

# Wait for both services to answer before reporting success.
wait_for() {
  local name=$1 url=$2
  for _ in $(seq 1 60); do
    if curl -sf -o /dev/null "$url"; then return 0; fi
    if ! is_running "$name"; then break; fi
    sleep 1
  done
  echo "The $name did not start. See $RUN_DIR/$name.log" >&2
  return 1
}
wait_for backend "http://127.0.0.1:$BACKEND_PORT/api/health"
wait_for frontend "http://127.0.0.1:$FRONTEND_PORT/"

echo "Prelegal is running at http://localhost:$FRONTEND_PORT (API at http://localhost:$BACKEND_PORT/docs)."
echo "Logs are in .run/. Stop with scripts/stop.sh."
