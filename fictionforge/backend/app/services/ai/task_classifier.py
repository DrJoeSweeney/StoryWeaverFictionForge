from enum import Enum
import re


class TaskTier(str, Enum):
    QUICK_EDIT = "quick_edit"      # Rewrite, shorten, expand — no reasoning needed
    CONTENT_GEN = "content_gen"    # Continue, describe — shallow context
    RESEARCH = "research"          # Historic/cultural research — web search
    DEEP_WORK = "deep_work"        # Draft chapter, create character — deep ReAct


# Quick edit actions need no reasoning
QUICK_EDIT_ACTIONS = {"rewrite", "shorten", "expand", "describe"}
CONTENT_GEN_ACTIONS = {"continue", "generate"}

# Keywords that trigger research (only when explicitly requested)
RESEARCH_KEYWORDS = {
    "research", "look up", "lookup", "find out about", "what were",
    "historically accurate", "historical", "real world", "real-world",
    "tell me about", "what is", "what are", "how did", "why did",
    "when did", "where did", "who was", "etymology", "origin of",
    "authentic", "period accurate", "era", "century", "medieval",
    "victorian", "roman", "mongol", "feudal", "renaissance",
}

# Keywords that indicate deep work
DEEP_WORK_KEYWORDS = {
    "create", "draft", "plan", "design", "build", "develop",
    "chapter", "character", "villain", "protagonist", "antagonist",
    "world", "setting", "plot", "arc", "outline", "manuscript",
    "story", "novel", "book", "scene", "beat", "act",
    "consistency", "check", "review", "fix", "plot hole",
}

# Confidence threshold for heuristic classification
HEURISTIC_CONFIDENCE_THRESHOLD = 0.7


def classify_task_heuristic(prompt: str, action: str | None = None) -> tuple[TaskTier, float]:
    """
    Fast heuristic classification. Returns (tier, confidence).
    Confidence < threshold means the heuristic is unsure — caller should use LLM fallback.
    """
    prompt_lower = prompt.lower().strip()
    words = set(re.findall(r'\b[\w\']+\b', prompt_lower))

    # Action-based classification (highest confidence)
    if action:
        if action in QUICK_EDIT_ACTIONS:
            return TaskTier.QUICK_EDIT, 1.0
        if action in CONTENT_GEN_ACTIONS:
            return TaskTier.CONTENT_GEN, 1.0

    # Very short prompts with edit keywords → quick edit
    if len(words) < 15:
        edit_words = {"rewrite", "rephrase", "shorten", "shorter", "expand", "longer",
                      "describe", "more detail", "less", " concise", "verbose",
                      "synonym", "alternative", "word for", "phrase for"}
        if any(w in prompt_lower for w in edit_words):
            return TaskTier.QUICK_EDIT, 0.9

    # Research detection — explicit keywords only
    research_matches = words & RESEARCH_KEYWORDS
    research_phrases = [
        "research ", "look up ", "find out about ", "what were ", "how did ",
        "tell me about ", "historically accurate", "real world", "etymology",
        "period accurate", "authentic ", "in the ", "century", "era ",
    ]
    has_research_phrase = any(p in prompt_lower for p in research_phrases)
    if research_matches or has_research_phrase:
        # Higher confidence if it starts with research verb
        starts_with_research = any(prompt_lower.startswith(w) for w in
                                   {"research", "look up", "find out", "what were",
                                    "how did", "tell me about", "who was"})
        confidence = 0.85 if starts_with_research else 0.75
        return TaskTier.RESEARCH, confidence

    # Deep work detection
    deep_matches = words & DEEP_WORK_KEYWORDS
    deep_phrases = [
        "write a chapter", "draft a ", "create a character", "new character",
        "plan the ", "outline the ", "design the world", "build the setting",
        "write the next chapter", "continue the story", "next scene",
        "consistency check", "plot hole", "does this make sense",
    ]
    has_deep_phrase = any(p in prompt_lower for p in deep_phrases)
    if deep_matches or has_deep_phrase:
        confidence = 0.8 if has_deep_phrase else 0.7
        return TaskTier.DEEP_WORK, confidence

    # Content generation fallback
    content_words = {"continue", "write", "generate", "compose", "add", "more",
                     "next", "following", "proceed", "go on"}
    if words & content_words:
        return TaskTier.CONTENT_GEN, 0.6

    # Default to content generation with low confidence
    return TaskTier.CONTENT_GEN, 0.5


CLASSIFIER_SYSTEM_PROMPT = """You are a task classifier for a novel-writing AI assistant.

Given a user's request, classify it into one of these tiers:
- QUICK_EDIT: Simple text edits (rewrite, shorten, expand, find synonym). No reasoning needed.
- CONTENT_GEN: Continue story, generate prose, apply writing skill. Needs style guide + outline.
- RESEARCH: Research real-world facts (history, culture, names, etymology). Needs web search.
- DEEP_WORK: Complex creative tasks (draft chapter, create character, plan story, consistency check). Needs deep multi-step reasoning.

Rules:
- RESEARCH only if the user is asking about REAL-WORLD facts, history, culture, or authenticity.
- "Continue my story" = CONTENT_GEN, not RESEARCH.
- "Research Victorian London" = RESEARCH.
- "Create a new villain" = DEEP_WORK.
- "Rewrite this paragraph" = QUICK_EDIT.

Respond with JSON only: {"tier": "QUICK_EDIT|CONTENT_GEN|RESEARCH|DEEP_WORK", "confidence": 0.0-1.0}"""


async def classify_task_llm(prompt: str, provider) -> tuple[TaskTier, float]:
    """
    LLM-based classification fallback for ambiguous prompts.
    Uses a lightweight call to the reasoning model.
    """
    from app.services.ai.base import Message
    import json

    messages = [
        Message(role="system", content=CLASSIFIER_SYSTEM_PROMPT),
        Message(role="user", content=f'Classify this request: "{prompt}"'),
    ]

    try:
        response = await provider.complete(
            messages=messages,
            model="",  # Provider will use default
            temperature=0.0,  # Deterministic
            max_tokens=128,
        )

        # Extract JSON
        json_match = re.search(r'\{[^}]+\}', response)
        if json_match:
            result = json.loads(json_match.group())
            tier_str = result.get("tier", "CONTENT_GEN")
            confidence = result.get("confidence", 0.5)
            return TaskTier(tier_str.lower()), confidence
    except Exception:
        pass

    # Fallback
    return TaskTier.CONTENT_GEN, 0.5


async def classify_task(prompt: str, action: str | None = None, provider=None) -> TaskTier:
    """
    Hybrid classifier: heuristic first, LLM fallback if uncertain.
    """
    tier, confidence = classify_task_heuristic(prompt, action)

    if confidence >= HEURISTIC_CONFIDENCE_THRESHOLD:
        return tier

    # Heuristic is unsure — use LLM if available
    if provider:
        tier, _ = await classify_task_llm(prompt, provider)
        return tier

    # No LLM available, go with heuristic best guess
    return tier
