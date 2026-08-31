"""Cache modules — cut (b).

Two flavors:
  - `sqlite_cache.TTLCache` — exact-match key → JSON, with per-entry TTL.
  - `vector_cache.VectorCache` — ChromaDB-backed semantic image cache.

Both degrade gracefully when their backing store is unavailable: TTLCache
swallows I/O errors and returns `None` on miss; VectorCache becomes a
no-op when chromadb isn't installed.
"""
