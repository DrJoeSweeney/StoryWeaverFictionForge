from app.services.ai.task_classifier import TaskTier
from app.services.storage.base import BaseStorage


class RetrievalResult:
    def __init__(self):
        self.documents: list[dict] = []
        self.characters: list[dict] = []
        self.story_bible: list[dict] = []
        self.style_guide: list[dict] = []
        self.outlines: list[dict] = []
        self.notes: list[dict] = []
        self.tokens_used: int = 0
        self.semantic_search_used: bool = False

    def get_consulted_docs(self) -> list[dict]:
        """Return a summary of all consulted documents for citation."""
        consulted = []
        for doc in self.documents:
            consulted.append({"type": "document", "title": doc.get("title", "Untitled"), "id": doc.get("id")})
        for char in self.characters:
            consulted.append({"type": "character", "title": char.get("name", "Unnamed"), "id": char.get("id")})
        for entry in self.story_bible:
            consulted.append({"type": "story_bible", "title": entry.get("title", "Untitled"), "id": entry.get("id")})
        for entry in self.style_guide:
            consulted.append({"type": "style_guide", "title": entry.get("title", "Untitled"), "id": entry.get("id")})
        for outline in self.outlines:
            consulted.append({"type": "outline", "title": outline.get("title", "Untitled"), "id": outline.get("id")})
        for note in self.notes:
            consulted.append({"type": "note", "title": note.get("title", "Untitled"), "id": note.get("id")})
        return consulted

    def to_prompt_text(self, max_tokens: int = 4000) -> str:
        """Convert retrieved context into a single text block for the LLM."""
        parts = []
        current_len = 0
        # Rough estimate: 1 token ≈ 4 chars
        char_budget = max_tokens * 4

        def add_section(title: str, items: list[dict], key: str = "content"):
            nonlocal current_len
            if not items:
                return
            section = f"\n## {title}\n"
            for item in items:
                name = item.get("title", item.get("name", "Untitled"))
                content = item.get(key, "")
                if not content:
                    content = item.get("notes", "")
                entry = f"\n### {name}\n{content}\n"
                if current_len + len(section) + len(entry) > char_budget:
                    section += "\n... (truncated)\n"
                    break
                section += entry
            parts.append(section)
            current_len += len(section)

        add_section("Style Guide", self.style_guide)
        add_section("Story Outlines", self.outlines)
        add_section("Characters", self.characters, key="notes")

        # Story Bible — include category labels for consistency awareness
        if self.story_bible:
            section = "\n## Story Bible / World-Building\n"
            for item in self.story_bible:
                name = item.get("title", "Untitled")
                category = item.get("category", "general")
                content = item.get("content", "")
                if not content:
                    content = item.get("notes", "")
                entry = f"\n### [{category.upper()}] {name}\n{content}\n"
                if current_len + len(section) + len(entry) > char_budget:
                    section += "\n... (truncated)\n"
                    break
                section += entry
            parts.append(section)
            current_len += len(section)

        add_section("Notes", self.notes)
        add_section("Relevant Documents", self.documents)

        return "\n".join(parts)


class ContextRetriever:
    def __init__(self, storage: BaseStorage):
        self.storage = storage

    async def _semantic_fetch(
        self,
        project_id: str,
        user_id: str,
        query: str,
        current_doc_id: str | None = None,
        top_k: int = 15,
        modules: list[str] | None = None,
    ) -> RetrievalResult | None:
        """
        Try to fetch context via semantic search.
        Returns None if embeddings are not available.
        """
        vs = getattr(self.storage, "vector_store", None)
        if not vs:
            return None

        try:
            filters = {"module": modules} if modules else None
            results = await vs.search(project_id, user_id, query, top_k=top_k, filters=filters)
            if not results:
                return None

            result = RetrievalResult()
            result.semantic_search_used = True

            # Categorize results by module and fetch full content
            doc_ids = set()
            for r in results:
                mod = r.get("module", "")
                # Use parent_id for chunked items
                item_id = r.get("metadata", {}).get("parent_id") or r["id"]

                if item_id in doc_ids:
                    continue
                doc_ids.add(item_id)

                if mod == "Writing" or mod == "Notes":
                    full = await self.storage.get_document(item_id, user_id)
                    if full:
                        if full.get("doc_type") == "note":
                            result.notes.append(full)
                        else:
                            result.documents.append(full)
                elif mod == "Characters":
                    full = await self.storage.get_character(item_id, user_id)
                    if full:
                        result.characters.append(full)
                elif mod == "StoryBible":
                    all_bible = await self.storage.list_story_bible(project_id, user_id)
                    for entry in all_bible:
                        if entry.get("id") == item_id:
                            result.story_bible.append(entry)
                            break
                elif mod == "StyleGuide":
                    all_style = await self.storage.list_style_guide(project_id, user_id)
                    for entry in all_style:
                        if entry.get("id") == item_id:
                            result.style_guide.append(entry)
                            break
                elif mod == "StoryPlan":
                    all_docs = await self.storage.list_documents(project_id, user_id)
                    for entry in all_docs:
                        if entry.get("id") == item_id and entry.get("doc_type") in ("outline", "scene", "beat"):
                            result.outlines.append(entry)
                            break

            # Always add current doc for continuity if editing a document
            if current_doc_id:
                current_doc = await self.storage.get_document(current_doc_id, user_id)
                if current_doc:
                    found = False
                    for i, d in enumerate(result.documents):
                        if d.get("id") == current_doc_id:
                            result.documents[i] = current_doc
                            found = True
                            break
                    if not found:
                        result.documents.insert(0, current_doc)

            return result
        except Exception:
            return None

    async def fetch_for_task(
        self,
        project_id: str,
        user_id: str,
        task_tier: TaskTier,
        prompt: str = "",
        current_doc_id: str | None = None,
        document_type: str | None = None,
        field_name: str | None = None,
    ) -> RetrievalResult:
        """
        Fetch relevant project context based on task tier and document type.
        """
        result = RetrievalResult()
        doc_type = (document_type or "").lower()

        if task_tier == TaskTier.QUICK_EDIT:
            return result

        # All non-quick tiers get style guide
        result.style_guide = await self.storage.list_style_guide(project_id, user_id)

        if task_tier == TaskTier.CONTENT_GEN:
            # Content generation always needs outlines
            all_docs = await self.storage.list_documents(project_id, user_id)
            result.outlines = [d for d in all_docs if d.get("doc_type") in ("outline", "scene", "beat")]

            # Try semantic search for supplemental context
            semantic = await self._semantic_fetch(
                project_id, user_id, prompt,
                current_doc_id=current_doc_id,
                top_k=10,
                modules=["Characters", "StoryBible", "Writing", "Notes"],
            )
            if semantic:
                # Merge semantic results, avoiding duplicates
                result.semantic_search_used = True
                result.characters = semantic.characters
                result.story_bible = semantic.story_bible
                # Merge documents/notes from semantic
                seen_doc_ids = {d.get("id") for d in result.documents}
                seen_note_ids = {n.get("id") for n in result.notes}
                for d in semantic.documents:
                    if d.get("id") not in seen_doc_ids:
                        result.documents.append(d)
                for n in semantic.notes:
                    if n.get("id") not in seen_note_ids:
                        result.notes.append(n)
                return result

            # Fallback to rule-based fetching
            if doc_type == "character":
                result.characters = await self.storage.list_characters(project_id, user_id)
                result.story_bible = await self.storage.list_story_bible(project_id, user_id)
            elif doc_type == "story_bible":
                result.characters = await self.storage.list_characters(project_id, user_id)
                result.story_bible = await self.storage.list_story_bible(project_id, user_id)
            elif doc_type == "note":
                docs = await self.storage.list_documents(project_id, user_id)
                result.notes = [d for d in docs if d.get("doc_type") == "note"][-3:]
                result.documents = [d for d in docs if d.get("doc_type") != "note"][-3:]

            return result

        if task_tier == TaskTier.RESEARCH:
            result.story_bible = await self.storage.list_story_bible(project_id, user_id)
            if doc_type == "character":
                result.characters = await self.storage.list_characters(project_id, user_id)
            elif doc_type == "note":
                docs = await self.storage.list_documents(project_id, user_id)
                result.notes = [d for d in docs if d.get("doc_type") == "note"][-3:]
            return result

        if task_tier == TaskTier.DEEP_WORK:
            semantic_result = await self._semantic_fetch(
                project_id, user_id, prompt, current_doc_id
            )
            if semantic_result and (
                semantic_result.documents
                or semantic_result.characters
                or semantic_result.story_bible
                or semantic_result.outlines
            ):
                semantic_result.style_guide = result.style_guide
                return semantic_result

            # Fallback: load everything
            all_docs = await self.storage.list_documents(project_id, user_id)
            result.outlines = [d for d in all_docs if d.get("doc_type") in ("outline", "scene", "beat")]
            result.characters = await self.storage.list_characters(project_id, user_id)
            result.story_bible = await self.storage.list_story_bible(project_id, user_id)

            docs = await self.storage.list_documents(project_id, user_id)
            notes = [d for d in docs if d.get("doc_type") == "note"]
            non_notes = [d for d in docs if d.get("doc_type") != "note"]
            result.notes = notes[-5:] if notes else []

            if current_doc_id:
                current_idx = next((i for i, d in enumerate(non_notes) if d.get("id") == current_doc_id), -1)
                if current_idx >= 0:
                    if current_idx > 0:
                        prev_doc = await self.storage.get_document(non_notes[current_idx - 1].get("id"), user_id)
                        if prev_doc:
                            result.documents.append(prev_doc)
                    current_doc = await self.storage.get_document(current_doc_id, user_id)
                    if current_doc:
                        result.documents.append(current_doc)
                else:
                    result.documents = non_notes[-3:]
            else:
                chapters = [d for d in non_notes if d.get("doc_type") in ("chapter", None)]
                result.documents = chapters[-3:] if chapters else non_notes[-3:]

            return result

        return result

    async def fetch_by_plan(
        self,
        project_id: str,
        user_id: str,
        needs: list[str],
        document_type: str | None = None,
        field_name: str | None = None,
    ) -> RetrievalResult:
        """
        Fetch specific documents based on a reasoning plan.
        """
        result = RetrievalResult()
        doc_type = (document_type or "").lower()

        for need in needs:
            need_lower = need.lower()

            if "style_guide" in need_lower or "style" in need_lower:
                result.style_guide = await self.storage.list_style_guide(project_id, user_id)

            elif "outline" in need_lower:
                all_docs = await self.storage.list_documents(project_id, user_id)
                result.outlines = [d for d in all_docs if d.get("doc_type") in ("outline", "scene", "beat")]

            elif "character" in need_lower:
                characters = await self.storage.list_characters(project_id, user_id)
                for char in characters:
                    char_name = char.get("name", "").lower()
                    if char_name and char_name in need_lower:
                        result.characters.append(char)
                if not result.characters:
                    result.characters = characters

            elif "story_bible" in need_lower or "world" in need_lower:
                result.story_bible = await self.storage.list_story_bible(project_id, user_id)

            elif "document" in need_lower or "chapter" in need_lower:
                docs = await self.storage.list_documents(project_id, user_id)
                non_notes = [d for d in docs if d.get("doc_type") != "note"]
                if "last" in need_lower or "previous" in need_lower or "recent" in need_lower:
                    result.documents = non_notes[-3:] if non_notes else []
                else:
                    for doc in non_notes:
                        doc_title = doc.get("title", "").lower()
                        if doc_title and doc_title in need_lower:
                            full_doc = await self.storage.get_document(doc.get("id"), user_id)
                            if full_doc:
                                result.documents.append(full_doc)
                    if not result.documents:
                        result.documents = non_notes[-3:] if non_notes else []

            elif "note" in need_lower:
                docs = await self.storage.list_documents(project_id, user_id)
                result.notes = [d for d in docs if d.get("doc_type") == "note"]

        return result
