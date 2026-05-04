import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.ai.context_retriever import ContextRetriever, RetrievalResult
from app.services.ai.task_classifier import TaskTier


@pytest.fixture
def mock_storage():
    storage = MagicMock()
    storage.list_style_guide = AsyncMock(return_value=[
        {"title": "Voice", "content": "Third person limited"},
    ])
    storage.list_outlines = AsyncMock(return_value=[
        {"title": "Act 1", "content": "The hero leaves home"},
    ])
    storage.list_characters = AsyncMock(return_value=[
        {"name": "Alice", "notes": "Brave protagonist"},
    ])
    storage.list_story_bible = AsyncMock(return_value=[
        {"title": "Magic System", "content": "Fire and ice"},
    ])
    storage.list_documents = AsyncMock(return_value=[
        {"id": "ch1", "title": "Chapter 1", "doc_type": "chapter", "content": "Once upon..."},
        {"id": "ch2", "title": "Chapter 2", "doc_type": "chapter", "content": "Then suddenly..."},
        {"id": "act1", "title": "Act 1", "doc_type": "outline", "content": "The hero leaves home"},
    ])
    storage.get_document = AsyncMock(return_value={
        "id": "ch1", "title": "Chapter 1", "content": "Full chapter text..."
    })
    return storage


class TestContextRetriever:
    @pytest.mark.asyncio
    async def test_quick_edit_returns_empty(self, mock_storage):
        retriever = ContextRetriever(mock_storage)
        result = await retriever.fetch_for_task(
            project_id="p1", user_id="u1", task_tier=TaskTier.QUICK_EDIT
        )
        assert result.documents == []
        assert result.style_guide == []
        assert result.to_prompt_text() == ""

    @pytest.mark.asyncio
    async def test_content_gen_fetches_style_guide_and_outlines(self, mock_storage):
        retriever = ContextRetriever(mock_storage)
        result = await retriever.fetch_for_task(
            project_id="p1", user_id="u1", task_tier=TaskTier.CONTENT_GEN
        )
        assert len(result.style_guide) == 1
        assert len(result.outlines) == 1
        text = result.to_prompt_text()
        assert "Voice" in text
        assert "Act 1" in text

    @pytest.mark.asyncio
    async def test_deep_work_fetches_everything(self, mock_storage):
        retriever = ContextRetriever(mock_storage)
        result = await retriever.fetch_for_task(
            project_id="p1", user_id="u1", task_tier=TaskTier.DEEP_WORK
        )
        assert len(result.style_guide) == 1
        assert len(result.outlines) == 1
        assert len(result.characters) == 1
        assert len(result.story_bible) == 1
        assert len(result.documents) > 0

    @pytest.mark.asyncio
    async def test_deep_work_with_current_doc(self, mock_storage):
        retriever = ContextRetriever(mock_storage)
        result = await retriever.fetch_for_task(
            project_id="p1", user_id="u1", task_tier=TaskTier.DEEP_WORK,
            current_doc_id="ch2"
        )
        assert len(result.documents) > 0
        mock_storage.get_document.assert_called()

    @pytest.mark.asyncio
    async def test_fetch_by_plan_style_guide(self, mock_storage):
        retriever = ContextRetriever(mock_storage)
        result = await retriever.fetch_by_plan(
            project_id="p1", user_id="u1", needs=["style_guide"]
        )
        assert len(result.style_guide) == 1
        assert len(result.outlines) == 0

    @pytest.mark.asyncio
    async def test_fetch_by_plan_character_by_name(self, mock_storage):
        retriever = ContextRetriever(mock_storage)
        result = await retriever.fetch_by_plan(
            project_id="p1", user_id="u1", needs=["character_Alice"]
        )
        assert len(result.characters) == 1
        assert result.characters[0]["name"] == "Alice"

    @pytest.mark.asyncio
    async def test_retrieval_result_consulted_docs(self, mock_storage):
        retriever = ContextRetriever(mock_storage)
        result = await retriever.fetch_for_task(
            project_id="p1", user_id="u1", task_tier=TaskTier.CONTENT_GEN
        )
        consulted = result.get_consulted_docs()
        assert len(consulted) == 2  # style_guide + outline
        assert consulted[0]["type"] == "style_guide"
        assert consulted[1]["type"] == "outline"

    def test_to_prompt_text_respects_budget(self):
        result = RetrievalResult()
        result.style_guide = [
            {"title": "Rule 1", "content": "A" * 10000},
        ]
        text = result.to_prompt_text(max_tokens=100)
        assert len(text) < 100 * 4 + 500  # rough budget + margin
        assert "truncated" in text or len(text) < 1000
