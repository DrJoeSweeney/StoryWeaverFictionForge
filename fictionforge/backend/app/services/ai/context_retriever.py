from app.services.ai.task_classifier import TaskTier
from app.services.storage.base import BaseStorage


class RetrievalResult:
    def __init__(self):
        self.documents: list[dict] = []
        self.characters: list[dict] = []
        self.story_bible: list[dict] = []
        self.style_guide: list[dict] = []
        self.outlines: list[dict] = []
        self.tokens_used: int = 0

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
        add_section("Story Bible / World-Building", self.story_bible)
        add_section("Relevant Documents", self.documents)

        return "\n".join(parts)


class ContextRetriever:
    def __init__(self, storage: BaseStorage):
        self.storage = storage

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
        document_type awareness improves relevance:
        - character → fetch other characters, story bible
        - story_bible → fetch characters, documents
        - outline → fetch all documents, characters
        - style_guide → fetch recent chapters
        - chapter/scene → fetch outline, previous chapters, characters
        - note → fetch related documents, story bible
        """
        result = RetrievalResult()
        doc_type = (document_type or "").lower()

        if task_tier == TaskTier.QUICK_EDIT:
            # No extra context needed
            return result

        # All non-quick tiers get style guide
        result.style_guide = await self.storage.list_style_guide(project_id, user_id)

        if task_tier == TaskTier.CONTENT_GEN:
            # Content generation needs outline for continuity
            result.outlines = await self.storage.list_outlines(project_id, user_id)

            # Document-type aware additions
            if doc_type == "character":
                # When editing a character, seeing other characters helps consistency
                result.characters = await self.storage.list_characters(project_id, user_id)
                result.story_bible = await self.storage.list_story_bible(project_id, user_id)
            elif doc_type == "story_bible":
                # World-building benefits from character context
                result.characters = await self.storage.list_characters(project_id, user_id)
                result.story_bible = await self.storage.list_story_bible(project_id, user_id)
            elif doc_type == "note":
                # Notes may reference documents
                docs = await self.storage.list_documents(project_id, user_id)
                result.documents = docs[-3:] if docs else []

            return result

        if task_tier == TaskTier.RESEARCH:
            # Research gets style guide + story bible (to avoid contradicting world rules)
            result.story_bible = await self.storage.list_story_bible(project_id, user_id)
            if doc_type == "character":
                result.characters = await self.storage.list_characters(project_id, user_id)
            return result

        if task_tier == TaskTier.DEEP_WORK:
            # Deep work gets everything, but we'll be smart about it
            result.outlines = await self.storage.list_outlines(project_id, user_id)
            result.characters = await self.storage.list_characters(project_id, user_id)
            result.story_bible = await self.storage.list_story_bible(project_id, user_id)

            # Documents: if we know current doc, get related ones; otherwise get recent chapters
            docs = await self.storage.list_documents(project_id, user_id)
            if current_doc_id:
                # Find the current doc and get nearby docs
                current_idx = next((i for i, d in enumerate(docs) if d.get("id") == current_doc_id), -1)
                if current_idx >= 0:
                    # Get previous doc for continuity
                    if current_idx > 0:
                        prev_doc = await self.storage.get_document(docs[current_idx - 1].get("id"), user_id)
                        if prev_doc:
                            result.documents.append(prev_doc)
                    # Get current doc context
                    current_doc = await self.storage.get_document(current_doc_id, user_id)
                    if current_doc:
                        result.documents.append(current_doc)
                else:
                    # Fallback: get last few docs
                    result.documents = docs[-3:]
            else:
                # No current doc — get last 3 chapters for continuity
                chapters = [d for d in docs if d.get("doc_type") in ("chapter", None)]
                result.documents = chapters[-3:] if chapters else docs[-3:]

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
        Used by the deep ReAct loop after the reasoning model decides what's needed.
        """
        result = RetrievalResult()
        doc_type = (document_type or "").lower()

        for need in needs:
            need_lower = need.lower()

            if "style_guide" in need_lower or "style" in need_lower:
                result.style_guide = await self.storage.list_style_guide(project_id, user_id)

            elif "outline" in need_lower:
                result.outlines = await self.storage.list_outlines(project_id, user_id)

            elif "character" in need_lower:
                characters = await self.storage.list_characters(project_id, user_id)
                # Try to find specific character by name
                for char in characters:
                    char_name = char.get("name", "").lower()
                    if char_name and char_name in need_lower:
                        result.characters.append(char)
                # If no specific match, include all
                if not result.characters:
                    result.characters = characters

            elif "story_bible" in need_lower or "world" in need_lower:
                result.story_bible = await self.storage.list_story_bible(project_id, user_id)

            elif "document" in need_lower or "chapter" in need_lower:
                docs = await self.storage.list_documents(project_id, user_id)
                if "last" in need_lower or "previous" in need_lower or "recent" in need_lower:
                    result.documents = docs[-3:] if docs else []
                else:
                    # Try to match by title
                    for doc in docs:
                        doc_title = doc.get("title", "").lower()
                        if doc_title and doc_title in need_lower:
                            full_doc = await self.storage.get_document(doc.get("id"), user_id)
                            if full_doc:
                                result.documents.append(full_doc)
                    if not result.documents:
                        result.documents = docs[-3:] if docs else []

        return result
