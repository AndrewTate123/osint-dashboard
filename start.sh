#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║         GEOINT Dashboard — Starting Up            ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# ── Backend ──────────────────────────────────────────────
echo "► Installing Python dependencies..."
cd "$ROOT/backend"
pip install -r requirements.txt -q

echo "► Starting FastAPI backend on http://localhost:8000"
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────────────────
echo "► Installing Node dependencies..."
cd "$ROOT/frontend"
npm install --silent

echo "► Starting React frontend on http://localhost:5173"
echo ""
echo "  Dashboard:  http://localhost:5173"
echo "  API docs:   http://localhost:8000/docs"
echo ""

# Trap to kill backend when script exits
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm run dev
