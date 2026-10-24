"""FastAPI entrypoint — `uvicorn app.main:app --reload`.

Wires the routers, sets CORS for the local frontend (Vite dev server),
and resolves the state-file path from `STATE_PATH` (default
`app/state.json`).

Run locally:
    cd nutrivision-demo/app
    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

Open http://localhost:8000/docs for the auto-generated Swagger UI.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import grocery, meals, nutrition, profile, vision
from app.services.state import init_state


def _state_path() -> Path:
    """Resolve the JSON-file path backing the in-memory state store.

    `STATE_PATH` is resolved relative to CWD when it isn't absolute —
    so `STATE_PATH=app/state.json` (the default in `.env.example`)
    works whether the user runs uvicorn from the repo root or from
    inside the `app/` directory.
    """
    raw = os.environ.get("STATE_PATH", "app/state.json")
    p = Path(raw)
    if not p.is_absolute():
        # Walk upward until we find a directory that already contains
        # `app/` — that's the repo root when running from `app/`.
        cwd = Path.cwd().resolve()
        for candidate in (cwd, *cwd.parents):
            if (candidate / "app").is_dir():
                p = (candidate / raw).resolve()
                break
        else:
            p = (cwd / raw).resolve()
    return p


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialize the state singleton on startup. `init_state` is
    idempotent — repeated calls are no-ops."""
    path = _state_path()
    init_state(path)
    yield


def _cors_origins() -> list[str]:
    """Read CORS allow-list from `CORS_ALLOW_ORIGINS` (comma-separated).
    Default keeps the local Vite dev server working. Set this env var
    to add a production frontend URL (e.g. the Vercel deployment) once
    the backend is reachable from the public internet."""
    raw = os.environ.get("CORS_ALLOW_ORIGINS", "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def create_app() -> FastAPI:
    """Build the FastAPI app. Factored out so tests can instantiate
    it with a fresh state file via `app.dependency_overrides`."""
    app = FastAPI(
        title="NutriVision AI backend",
        version="0.1.0",
        description=(
            "FastAPI backend for meal vision, nutrition, profile, grocery, "
            "and meal APIs. Gemini and Hugging Face vision providers are "
            "used when their server-side credentials are configured."
        ),
        lifespan=lifespan,
    )

    # CORS — env-driven so a production deploy can add the Vercel origin
    # without a code change. Default keeps local Vite dev working.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(vision.router)
    app.include_router(nutrition.router)
    app.include_router(profile.router)
    app.include_router(grocery.router)
    app.include_router(meals.router)

    @app.get("/", tags=["meta"])
    def root() -> dict[str, str]:
        """Tiny index — the real value is at /docs."""
        return {
            "service": "nutrivision-backend",
            "docs": "/docs",
        }

    @app.get("/health", tags=["meta"])
    def health() -> dict[str, str]:
        """Liveness endpoint used by the hosting platform."""
        return {"status": "ok"}

    return app


app = create_app()