#!/usr/bin/env python3
"""Pre-download the ChromaDB ONNX embedding model during build time.

Avoids 79 MB download on Render cold boot, eliminating port scan timeouts.
"""

from __future__ import annotations

import sys


def main() -> int:
    try:
        import chromadb.utils.embedding_functions as ef

        print("Pre-downloading all-MiniLM-L6-v2 ONNX model for ChromaDB...", flush=True)
        ef.DefaultEmbeddingFunction()
        print("ONNX model pre-download complete.", flush=True)
        return 0
    except Exception as exc:
        print(f"Warning: Model pre-download skipped or failed ({exc}). Will load lazily on demand.", flush=True)
        return 0


if __name__ == "__main__":
    sys.exit(main())

