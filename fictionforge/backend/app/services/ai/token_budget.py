"""Token budgeting utilities for context window management."""

import json


def estimate_tokens(text: str) -> int:
    """Rough token estimation: ~4 chars per token for English text."""
    return max(1, len(text) // 4)


def estimate_message_tokens(messages: list) -> int:
    """Estimate tokens for a list of messages."""
    total = 0
    for msg in messages:
        content = msg.content if hasattr(msg, "content") else msg.get("content", "")
        total += estimate_tokens(content)
        # Add overhead for role and formatting
        total += 4
    return total


def get_context_budget(model_id: str = "", context_window: int = 4096, reserve_tokens: int = 2000) -> int:
    """
    Calculate how many tokens we can use for context injection.
    Reserve tokens for the user's prompt and the model's response.
    """
    return max(0, context_window - reserve_tokens)


def truncate_to_budget(text: str, max_tokens: int) -> str:
    """Truncate text to fit within a token budget."""
    estimated = estimate_tokens(text)
    if estimated <= max_tokens:
        return text

    # Rough char budget
    char_budget = max_tokens * 4
    if len(text) > char_budget:
        truncated = text[:char_budget]
        # Try to end at a sentence boundary
        last_period = truncated.rfind(".")
        if last_period > char_budget * 0.8:
            truncated = truncated[:last_period + 1]
        return truncated + "\n\n... [truncated]"
    return text


class TokenBudget:
    def __init__(self, context_window: int = 4096, reserve_tokens: int = 2000):
        self.context_window = context_window
        self.reserve_tokens = reserve_tokens
        self.budget = get_context_budget(context_window=context_window, reserve_tokens=reserve_tokens)
        self.used = 0

    def allocate(self, text: str, priority: int = 1) -> str:
        """
        Allocate tokens for a piece of text.
        Higher priority = more likely to be included in full.
        Returns truncated text if necessary.
        """
        estimated = estimate_tokens(text)
        remaining = self.budget - self.used

        if estimated <= remaining:
            self.used += estimated
            return text

        # Not enough budget — truncate
        available = max(0, remaining)
        truncated = truncate_to_budget(text, available)
        self.used += estimate_tokens(truncated)
        return truncated

    def can_fit(self, text: str) -> bool:
        """Check if text fits within remaining budget."""
        return estimate_tokens(text) <= (self.budget - self.used)

    def remaining(self) -> int:
        """Return remaining token budget."""
        return max(0, self.budget - self.used)

    def report(self) -> dict:
        """Return a summary of token usage."""
        return {
            "context_window": self.context_window,
            "reserve_tokens": self.reserve_tokens,
            "budget": self.budget,
            "used": self.used,
            "remaining": self.remaining(),
            "percent_used": round(self.used / self.budget * 100, 1) if self.budget > 0 else 0,
        }
