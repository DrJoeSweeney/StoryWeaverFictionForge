#!/bin/bash

# Start script for FictionForge backend and frontend
# Usage: ./start.sh
# Press Ctrl+C to stop both services

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo "Shutting down services..."
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
        wait "$FRONTEND_PID" 2>/dev/null || true
        echo "  Frontend stopped"
    fi
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
        echo "  Backend stopped"
    fi
}

trap cleanup INT TERM EXIT

echo "Starting FictionForge..."
echo ""

# Start Backend
cd "$PROJECT_ROOT/backend"
source venv/bin/activate

export APP_ENV=development
export PYTHONUNBUFFERED=1

if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

echo "Starting backend (FastAPI + Uvicorn) on http://localhost:8000 ..."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > backend.log 2>&1 &
BACKEND_PID=$!

# Start Frontend
cd "$PROJECT_ROOT/frontend"
echo "Starting frontend (Vite) on http://localhost:5173 ..."
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

echo ""
echo "Both services are running in the background:"
echo "  Backend:  http://localhost:8000  (logs: backend/backend.log)"
echo "  Frontend: http://localhost:5173  (logs: frontend/frontend.log)"
echo ""
echo "Press Ctrl+C to stop both services."
echo ""

# Wait for either process to exit
wait -n "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
