#!/usr/bin/env bash
# Stop the Prelegal backend and frontend started by scripts/start.sh.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT/.run"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# Kill a process and all of its children.
kill_tree() {
  local pid=$1
  if [ -r "/proc/$pid/winpid" ]; then
    # Git Bash on Windows: npm and uv start native child processes, so use taskkill /T.
    taskkill //F //T //PID "$(cat "/proc/$pid/winpid")" >/dev/null 2>&1
  else
    for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
    kill "$pid" 2>/dev/null
  fi
}

# Fallback: stop whatever is still listening on a port.
free_port() {
  local port=$1
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null | xargs -r kill 2>/dev/null
  elif command -v netstat >/dev/null 2>&1 && command -v taskkill >/dev/null 2>&1; then
    for pid in $(netstat -ano | awk -v p=":$port" '$2 ~ p"$" && $4 == "LISTENING" {print $5}' | sort -u); do
      taskkill //F //T //PID "$pid" >/dev/null 2>&1
    done
  fi
}

for name in frontend backend; do
  if [ -f "$RUN_DIR/$name.pid" ]; then
    kill_tree "$(cat "$RUN_DIR/$name.pid")"
    rm -f "$RUN_DIR/$name.pid"
  fi
done
free_port "$FRONTEND_PORT"
free_port "$BACKEND_PORT"

echo "Prelegal stopped."
