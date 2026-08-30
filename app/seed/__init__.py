"""Seed fixtures — server-side mirror of `src/mocks/fixtures.ts`.

Kept intentionally tiny: the skeleton only needs canned values that
let each endpoint round-trip a non-trivial response. The frontend
remains the source of truth for what users see; this module just
gives the backend something to serve on first boot.
"""
