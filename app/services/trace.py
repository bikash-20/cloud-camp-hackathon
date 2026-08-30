"""PipelineTrace helpers.

The frontend's `CaptureScreen` shows a tiny toast that labels each
stage of the analysis pipeline. The skeleton returns the same
`PipelineTrace[]` shape so the toast lights up unchanged when wired
to the backend in cut (b).
"""

from __future__ import annotations

import time

from app.models.schemas import PipelineStatus, PipelineTrace


def make_trace(
    stage: str,
    label: str,
    status: PipelineStatus = "done",
    *,
    started_at: int | None = None,
    finished_at: int | None = None,
) -> PipelineTrace:
    """Build a single trace entry with sensible defaults.

    `started_at` / `finished_at` default to the current wall-clock ms so
    most callers don't need to think about timing — but explicit values
    can be passed for testing or when the route times each stage
    individually.

    Named `make_trace` (not `trace`) because the module itself is named
    `trace.py` — calling the function `trace()` would shadow the module
    on import and produce a confusing `TypeError`.
    """
    now = time.time_ns() // 1_000_000
    return PipelineTrace(
        stage=stage,  # type: ignore[arg-type]
        status=status,
        started_at=started_at if started_at is not None else now,
        finished_at=finished_at if finished_at is not None else now,
        label=label,
    )
