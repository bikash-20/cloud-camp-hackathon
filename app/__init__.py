"""NutriVision AI backend (cut a — contract-only skeleton).

A lean FastAPI service that mirrors the frontend's mock API surface
(`src/lib/api.ts`) so the two can be wired together without shape
drift. Vision and most nutrition lookups are stubbed; Open Food Facts
is the only live external dependency and runs without API keys.
"""