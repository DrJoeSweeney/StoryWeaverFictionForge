import pytest
from app.services.ai.web_search import WebSearchResult, WebSearchTool


class TestWebSearchTool:
    def test_format_for_prompt_empty(self):
        tool = WebSearchTool()
        text = tool.format_for_prompt([])
        assert "No web search results" in text

    def test_format_for_prompt_with_results(self):
        tool = WebSearchTool()
        results = [
            WebSearchResult("Title 1", "http://example.com/1", "Snippet one"),
            WebSearchResult("Title 2", "http://example.com/2", "Snippet two"),
        ]
        text = tool.format_for_prompt(results)
        assert "Title 1" in text
        assert "Snippet one" in text
        assert "http://example.com/1" in text
        assert "Title 2" in text

    def test_web_search_result_to_text(self):
        r = WebSearchResult("Test", "http://test.com", "A test snippet")
        text = r.to_text()
        assert "Test" in text
        assert "A test snippet" in text
        assert "http://test.com" in text

    @pytest.mark.asyncio
    async def test_search_duckduckgo_smoke(self):
        """Basic smoke test — verifies the search runs without crashing.
        May return 0 results in CI due to rate limiting."""
        tool = WebSearchTool(backend="duckduckgo")
        results = await tool.search("Python programming language", max_results=2)
        assert isinstance(results, list)
        if len(results) > 0:
            assert all(isinstance(r, WebSearchResult) for r in results)
            assert results[0].title is not None
