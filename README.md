# Qiskit Project — Quantum Chemistry UI

A focused, user-friendly tool for running quantum chemistry simulations with
Qiskit. This repository contains a Flask-based backend, a React frontend (under
`interface-react/`), utilities for molecular data and calculators, and basic
test coverage for the API.

This README is tailored to this codebase and explains how to run the backend
server, the frontend, run tests, and contribute.

## Highlights

- Backend: Flask application (entry point: `app.py`) that exposes REST endpoints
  used by the UI and CLI utilities.
- Frontend: React app in `interface-react/` that provides the UI for creating
  molecules, running jobs, and visualizing results.
- Domain: Quantum chemistry workflows (VQE, SCF helpers, integrals, molecular
  building) powered by Qiskit and scientific Python libraries.

## Repo layout (important files)

- `app.py` — Flask app entry point (run with `python app.py`).
- `api_server.py` — alternative server wrapper used for deployments.
- `app/` — backend package: routes, services, and business logic.
- `config/` — configuration helper and defaults (`config/settings.py`).
- `interface-react/` — frontend application (React + Vite).
- `requirements.txt` — Python dependencies for the backend.
- `tests/` — tests for the API and helper scripts.
- `storage/` — persistent storage for sessions, jobs and molecule files.

## Quickstart — Backend (local)

Minimum: Python 3.8+ and a working internet connection for pip packages.

1. Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Install Python dependencies:

```bash
pip install -r requirements.txt
```

3. Start the backend server (development):

```bash
python app.py
```

By default the app prints the server URL and a health endpoint. Example:

```
🚀 Server running on http://127.0.0.1:5000
📊 Health check: http://127.0.0.1:5000/health
```

Notes:

- `app.py` uses the `Config` object in `config/settings.py` for `HOST`, `PORT`
  and `DEBUG`. You can set those via environment variables if supported by your
  `Config` implementation.
- If you'd prefer an ASGI server in front of the app, you can run with
  `gunicorn` or `uvicorn` wrappers, but the Flask `app.run()` call is the
  supported developer flow here.

## Quickstart — Frontend (local)

1. Change to the frontend folder and install dependencies:

```bash
cd interface-react
npm install
npm run dev
```

2. Open the UI in your browser (typically at `http://localhost:5173` when using
   Vite) and point it at the backend configured host/port.


## Development notes

- Logs are written to the `logs/` directory (e.g. `logs/app.log`). Keep an eye
  on those when troubleshooting.
- Session and job JSONs are stored under `storage/` by default.
- When adding features, prefer adding tests under `tests/` and update
  `requirements.txt` if you add runtime dependencies.
