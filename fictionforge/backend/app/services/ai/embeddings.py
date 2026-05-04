"""Lightweight local embedding service using fastembed (ONNX-based, no PyTorch)."""

import numpy as np
import hashlib
from typing import List

# Lazy-load the embedding model to avoid import-time overhead
_embedding_model = None

DEFAULT_MODEL = "BAAI/bge-small-en-v1.5"  # 384-dim, ~33MB, fast on CPU


def _get_model():
    global _embedding_model
    if _embedding_model is None:
        from fastembed import TextEmbedding
        _embedding_model = TextEmbedding(model_name=DEFAULT_MODEL)
    return _embedding_model


def embed_text(text: str) -> np.ndarray:
    """Embed a single text string into a normalized 384-dim vector."""
    model = _get_model()
    vec = next(model.embed([text]))
    return np.array(vec, dtype=np.float32)


def embed_texts(texts: List[str]) -> List[np.ndarray]:
    """Embed multiple texts in a batch."""
    if not texts:
        return []
    model = _get_model()
    return [np.array(v, dtype=np.float32) for v in model.embed(texts)]


def text_hash(text: str) -> str:
    """Return a short hash of text for change detection."""
    return hashlib.md5(text.encode("utf-8")).hexdigest()[:16]


def cosine_similarity(query: np.ndarray, vectors: np.ndarray) -> np.ndarray:
    """
    Compute cosine similarity between a query vector and a matrix of vectors.
    query: (D,) array
    vectors: (N, D) array
    returns: (N,) array of similarities in [-1, 1]
    """
    # Vectors from fastembed are already normalized, but be safe
    query_norm = query / (np.linalg.norm(query) + 1e-10)
    vecs_norm = vectors / (np.linalg.norm(vectors, axis=1, keepdims=True) + 1e-10)
    return vecs_norm @ query_norm
