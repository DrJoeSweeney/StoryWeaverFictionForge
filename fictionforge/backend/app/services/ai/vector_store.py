"""Simple numpy-based vector store with JSON persistence and document chunking."""

import os
import json
import re
import numpy as np
from datetime import datetime
from typing import List, Dict, Any

from app.services.ai.embeddings import embed_text, embed_texts, text_hash, cosine_similarity

CHUNK_SIZE_WORDS = 500  # Target words per chunk
CHUNK_OVERLAP_WORDS = 50  # Overlap between chunks for continuity


def _chunk_text(text: str, max_words: int = CHUNK_SIZE_WORDS, overlap: int = CHUNK_OVERLAP_WORDS) -> List[str]:
    """Split text into overlapping chunks by paragraph, falling back to sentences."""
    if not text:
        return []

    words = text.split()
    if len(words) <= max_words:
        return [text]

    # Try paragraph splitting first
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    chunks = []
    current_chunk_words = []
    current_len = 0

    for para in paragraphs:
        para_words = para.split()
        if current_len + len(para_words) <= max_words:
            current_chunk_words.extend(para_words)
            current_len += len(para_words)
        else:
            if current_chunk_words:
                chunks.append(" ".join(current_chunk_words))
            # Start new chunk with overlap from previous
            if current_chunk_words and overlap > 0:
                overlap_words = current_chunk_words[-overlap:]
                current_chunk_words = overlap_words + para_words
                current_len = len(current_chunk_words)
            else:
                current_chunk_words = para_words
                current_len = len(para_words)

            # If single paragraph still too long, split by sentences
            if current_len > max_words:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                current_chunk_words = []
                current_len = 0
                for sent in sentences:
                    sent_words = sent.split()
                    if current_len + len(sent_words) <= max_words:
                        current_chunk_words.extend(sent_words)
                        current_len += len(sent_words)
                    else:
                        if current_chunk_words:
                            chunks.append(" ".join(current_chunk_words))
                        current_chunk_words = sent_words
                        current_len = len(sent_words)
                # Don't flush yet — may add more paragraphs

    if current_chunk_words:
        chunks.append(" ".join(current_chunk_words))

    # Deduplicate empty chunks
    return [c for c in chunks if c.strip()]


class VectorStore:
    """
    Project-scoped vector store backed by a JSON file.
    Stores embeddings for all project content items with metadata.
    Supports chunking for long documents.
    """

    def __init__(self, root_path: str):
        self.root_path = os.path.expanduser(root_path)

    def _project_embed_path(self, project_id: str, user_id: str) -> str:
        return os.path.join(
            self.root_path, "users", user_id, project_id, ".embeddings.json"
        )

    def _load(self, project_id: str, user_id: str) -> Dict[str, Any]:
        path = self._project_embed_path(project_id, user_id)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"version": 2, "items": [], "updated_at": ""}

    def _save(self, project_id: str, user_id: str, data: Dict[str, Any]):
        path = self._project_embed_path(project_id, user_id)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        data["updated_at"] = datetime.now().isoformat()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def _items_to_matrix(self, items: List[Dict]) -> np.ndarray:
        """Convert list of item dicts to an (N, D) numpy array."""
        if not items:
            return np.array([]).reshape(0, 0)
        return np.array([item["embedding"] for item in items], dtype=np.float32)

    def _chunk_id(self, parent_id: str, index: int) -> str:
        return f"{parent_id}_chunk_{index}"

    async def upsert(
        self,
        project_id: str,
        user_id: str,
        item_id: str,
        text: str,
        module: str,
        classification: str,
        metadata: Dict[str, Any] | None = None,
    ) -> bool:
        """
        Embed and store (or update) a single item.
        Long texts are automatically chunked.
        Returns True if any embedding was updated.
        """
        data = self._load(project_id, user_id)
        items = data.get("items", [])
        meta = metadata or {}

        chunks = _chunk_text(text)
        is_chunked = len(chunks) > 1

        # Determine if anything changed by comparing hash of all chunks
        all_text = "\n".join(chunks)
        txt_hash = text_hash(all_text)

        # Find existing items for this parent
        existing_items = [i for i in items if i["id"] == item_id or i.get("metadata", {}).get("parent_id") == item_id]
        if existing_items and not is_chunked:
            # Single chunk case — check if existing single item matches
            single = next((i for i in existing_items if i["id"] == item_id), None)
            if single and single.get("text_hash") == txt_hash:
                return False  # No change

        # Remove old entries for this item (and its chunks)
        items = [i for i in items if i["id"] != item_id and i.get("metadata", {}).get("parent_id") != item_id]

        if is_chunked:
            # Embed all chunks
            embeddings = embed_texts(chunks)
            for idx, (chunk_text, emb) in enumerate(zip(chunks, embeddings)):
                chunk_meta = {**meta, "parent_id": item_id, "chunk_index": idx, "total_chunks": len(chunks)}
                items.append(
                    {
                        "id": self._chunk_id(item_id, idx),
                        "text_hash": text_hash(chunk_text),
                        "embedding": emb.tolist(),
                        "module": module,
                        "classification": classification,
                        "metadata": chunk_meta,
                        "updated_at": datetime.now().isoformat(),
                    }
                )
        else:
            # Single item
            embedding = embed_text(all_text)
            items.append(
                {
                    "id": item_id,
                    "text_hash": txt_hash,
                    "embedding": embedding.tolist(),
                    "module": module,
                    "classification": classification,
                    "metadata": meta,
                    "updated_at": datetime.now().isoformat(),
                }
            )

        data["items"] = items
        self._save(project_id, user_id, data)
        return True

    async def delete(self, project_id: str, user_id: str, item_id: str) -> bool:
        """Remove an item and all its chunks from the vector store."""
        data = self._load(project_id, user_id)
        items = data.get("items", [])
        original_len = len(items)
        items = [
            i for i in items
            if i["id"] != item_id and i.get("metadata", {}).get("parent_id") != item_id
        ]
        if len(items) != original_len:
            data["items"] = items
            self._save(project_id, user_id, data)
            return True
        return False

    async def search(
        self,
        project_id: str,
        user_id: str,
        query: str,
        top_k: int = 10,
        filters: Dict[str, List[str]] | None = None,
    ) -> List[Dict[str, Any]]:
        """
        Semantic search over project embeddings.
        Returns list of {id, module, classification, score, metadata} dicts.
        For chunked items, metadata includes parent_id.
        
        filters: dict like {"module": ["Characters", "StoryBible"]} to restrict search.
        """
        data = self._load(project_id, user_id)
        items = data.get("items", [])
        if not items:
            return []

        # Apply filters
        if filters:
            filtered = []
            for item in items:
                match = True
                for key, allowed in filters.items():
                    if item.get(key) not in allowed:
                        match = False
                        break
                if match:
                    filtered.append(item)
            items = filtered

        if not items:
            return []

        # Embed query and compute similarities
        query_vec = embed_text(query)
        matrix = self._items_to_matrix(items)
        scores = cosine_similarity(query_vec, matrix)

        # Sort by score descending
        indexed_scores = [(i, float(scores[i])) for i in range(len(items))]
        indexed_scores.sort(key=lambda x: x[1], reverse=True)

        # Deduplicate by parent_id (only return best chunk per parent)
        seen_parents = set()
        results = []
        for idx, score in indexed_scores:
            item = items[idx]
            parent_id = item.get("metadata", {}).get("parent_id")
            dedup_key = parent_id if parent_id else item["id"]
            if dedup_key in seen_parents:
                continue
            seen_parents.add(dedup_key)
            results.append(
                {
                    "id": item["id"],
                    "module": item["module"],
                    "classification": item["classification"],
                    "score": round(score, 4),
                    "metadata": item.get("metadata", {}),
                }
            )
            if len(results) >= top_k:
                break
        return results

    async def build_index(
        self,
        project_id: str,
        user_id: str,
        storage,
    ) -> Dict[str, Any]:
        """
        (Re)build the entire embedding index for a project from storage.
        Returns summary stats.
        """
        # Collect all project content
        docs = await storage.list_documents(project_id, user_id)
        chars = await storage.list_characters(project_id, user_id)
        bible = await storage.list_story_bible(project_id, user_id)
        style = await storage.list_style_guide(project_id, user_id)
        outlines = await storage.list_outlines(project_id, user_id)

        # Flatten into embeddable records
        records = []
        for d in docs:
            records.append(
                {
                    "id": d["id"],
                    "text": f"{d.get('title', '')}\n{d.get('content', '')}",
                    "module": d.get("module", "Writing"),
                    "classification": d.get("classification", "General"),
                    "metadata": {"title": d.get("title", ""), "type": "document"},
                }
            )
        for c in chars:
            text_parts = [f"Name: {c.get('name', '')}"]
            for field in ["aliases", "archetype", "age", "appearance", "personality", "background", "goals", "conflicts", "voice_description", "notes"]:
                val = c.get(field)
                if val:
                    text_parts.append(f"{field}: {val}")
            records.append(
                {
                    "id": c["id"],
                    "text": "\n".join(text_parts),
                    "module": c.get("module", "Characters"),
                    "classification": c.get("classification", "General"),
                    "metadata": {"name": c.get("name", ""), "type": "character"},
                }
            )
        for b in bible:
            records.append(
                {
                    "id": b["id"],
                    "text": f"{b.get('title', '')}\n{b.get('content', '')}",
                    "module": b.get("module", "StoryBible"),
                    "classification": b.get("classification", "General"),
                    "metadata": {"title": b.get("title", ""), "type": "story_bible"},
                }
            )
        for s in style:
            records.append(
                {
                    "id": s["id"],
                    "text": f"{s.get('title', '')}\n{s.get('content', '')}",
                    "module": s.get("module", "StyleGuide"),
                    "classification": s.get("classification", "General"),
                    "metadata": {"title": s.get("title", ""), "type": "style_guide"},
                }
            )
        for o in outlines:
            records.append(
                {
                    "id": o["id"],
                    "text": f"{o.get('title', '')}\n{o.get('content', '')}",
                    "module": o.get("module", "StoryPlan"),
                    "classification": o.get("classification", "General"),
                    "metadata": {"title": o.get("title", ""), "type": "outline"},
                }
            )

        if not records:
            # Still save empty index
            data = {"version": 2, "items": [], "updated_at": datetime.now().isoformat()}
            self._save(project_id, user_id, data)
            return {"indexed": 0, "chunks": 0, "errors": 0}

        # Chunk and embed
        total_chunks = 0
        items = []
        for rec in records:
            chunks = _chunk_text(rec["text"])
            total_chunks += len(chunks)
            if len(chunks) > 1:
                embeddings = embed_texts(chunks)
                for idx, (chunk_text, emb) in enumerate(zip(chunks, embeddings)):
                    items.append(
                        {
                            "id": self._chunk_id(rec["id"], idx),
                            "text_hash": text_hash(chunk_text),
                            "embedding": emb.tolist(),
                            "module": rec["module"],
                            "classification": rec["classification"],
                            "metadata": {**rec["metadata"], "parent_id": rec["id"], "chunk_index": idx, "total_chunks": len(chunks)},
                            "updated_at": datetime.now().isoformat(),
                        }
                    )
            else:
                emb = embed_text(chunks[0]) if chunks else embed_text("")
                items.append(
                    {
                        "id": rec["id"],
                        "text_hash": text_hash(chunks[0]) if chunks else text_hash(""),
                        "embedding": emb.tolist(),
                        "module": rec["module"],
                        "classification": rec["classification"],
                        "metadata": rec["metadata"],
                        "updated_at": datetime.now().isoformat(),
                    }
                )

        data = {"version": 2, "items": items, "updated_at": datetime.now().isoformat()}
        self._save(project_id, user_id, data)

        return {"indexed": len(records), "chunks": total_chunks, "errors": 0}
