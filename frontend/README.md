<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Frontend + Python Backend Integration

This frontend runs on an Express + Vite server and proxies API requests to the FastAPI backend.

## Prerequisites

- Node.js 18+
- Python 3.10+

## 1) Start the Python backend

From the workspace root:

1. Install Python dependencies:
   pip install -r requirements.txt
2. Start FastAPI:
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload

## 2) Start the frontend

From the frontend folder:

1. Install dependencies:
   npm install
2. Create local env file:
   cp .env.example .env.local
3. (Optional) If backend is not on localhost:8000, edit BACKEND_URL in .env.local
4. Start frontend:
   npm run dev

Frontend runs on http://localhost:3000 and sends /api/run-backtest to the FastAPI backend via server-side proxy.

## 3) Deploy on Vercel

This repo is now configured for a single Vercel project:

- Static frontend from `frontend/dist`
- Python Serverless Function at `/api/run-backtest` from `api/run-backtest/index.py`

### Deploy steps

1. Import the repository in Vercel.
2. Keep the project Root Directory as repository root.
3. Vercel will use `vercel.json` automatically:
   - Install command: installs frontend npm deps
   - Build command: runs `vite build`
   - Output directory: `frontend/dist`
   - API function: `api/run-backtest/index.py`
4. Deploy.

### Notes

- No frontend code changes are required for production API calls because the app already uses `/api/run-backtest`.
- Vercel Python dependencies are installed from repository root `requirements.txt`.
