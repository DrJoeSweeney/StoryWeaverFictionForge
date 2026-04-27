import pytest
from app.services.ai.token_budget import TokenBudget, estimate_tokens, truncate_to_budget


class TestTokenBudget:
    def test_estimate_tokens_basic(self):
        text = "Hello world"
        assert estimate_tokens(text) == len(text) // 4

    def test_truncate_to_budget_no_change(self):
        text = "Short text"
        result = truncate_to_budget(text, 100)
        assert result == text

    def test_truncate_to_budget_truncates(self):
        text = "A" * 10000
        result = truncate_to_budget(text, 100)
        assert len(result) < len(text)
        assert "truncated" in result

    def test_token_budget_allocate(self):
        budget = TokenBudget(context_window=1000, reserve_tokens=200)
        assert budget.budget == 800

        text = "A" * 400  # ~100 tokens
        allocated = budget.allocate(text)
        assert allocated == text
        assert budget.used >= 100

    def test_token_budget_truncates_when_exceeded(self):
        budget = TokenBudget(context_window=1000, reserve_tokens=200)
        text = "A" * 4000  # ~1000 tokens, exceeds 800 budget
        allocated = budget.allocate(text)
        assert len(allocated) < len(text)
        assert budget.used <= budget.budget + 10  # small margin

    def test_token_budget_can_fit(self):
        budget = TokenBudget(context_window=1000, reserve_tokens=200)
        assert budget.can_fit("A" * 400)  # ~100 tokens
        assert not budget.can_fit("A" * 4000)  # ~1000 tokens

    def test_token_budget_report(self):
        budget = TokenBudget(context_window=10000, reserve_tokens=2000)
        budget.allocate("A" * 4000)  # ~1000 tokens
        report = budget.report()
        assert report["context_window"] == 10000
        assert report["budget"] == 8000
        assert report["used"] >= 1000
        assert report["remaining"] >= 6000
        assert 0 <= report["percent_used"] <= 100
