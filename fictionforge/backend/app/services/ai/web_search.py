import asyncio
from typing import AsyncIterator


class WebSearchResult:
    def __init__(self, title: str, url: str, snippet: str):
        self.title = title
        self.url = url
        self.snippet = snippet

    def to_text(self) -> str:
        return f"**{self.title}**\n{self.snippet}\n<{self.url}>"


class WebSearchTool:
    """Web search abstraction with multiple backends."""

    def __init__(self, backend: str = "duckduckgo"):
        self.backend = backend

    async def search(self, query: str, max_results: int = 5) -> list[WebSearchResult]:
        """Execute a web search and return results."""
        if self.backend == "duckduckgo":
            return await self._search_duckduckgo(query, max_results)
        return []

    async def _search_duckduckgo(self, query: str, max_results: int = 5) -> list[WebSearchResult]:
        """Search using DuckDuckGo (no API key required)."""
        try:
            # Try newer ddgs package first, fall back to duckduckgo_search
            try:
                from ddgs import DDGS
            except ImportError:
                from duckduckgo_search import DDGS

            # Run in thread pool since DDGS may block
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(
                None,
                lambda: list(DDGS().text(query, max_results=max_results)),
            )

            return [
                WebSearchResult(
                    title=r.get("title", "Untitled"),
                    url=r.get("href", ""),
                    snippet=r.get("body", ""),
                )
                for r in results
            ]
        except Exception as e:
            # Fallback: return empty with error info
            return [WebSearchResult(
                title="Search Error",
                url="",
                snippet=f"Web search failed: {str(e)}. Results will be based on training data only.",
            )]

    def format_for_prompt(self, results: list[WebSearchResult]) -> str:
        """Format search results for inclusion in an LLM prompt."""
        if not results:
            return "No web search results available."

        parts = ["## Web Search Results\n"]
        for i, r in enumerate(results, 1):
            parts.append(f"{i}. {r.to_text()}")
        return "\n\n".join(parts)


# Global instance
web_search_tool = WebSearchTool()
