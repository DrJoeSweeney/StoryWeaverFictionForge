from enum import Enum
import re

from app.services.ai.prompt_renderer import render_prompt


class TaskTier(str, Enum):
    QUICK_EDIT = "quick_edit"      # Rewrite, shorten, expand — no reasoning needed
    CONTENT_GEN = "content_gen"    # Continue, describe — shallow context
    RESEARCH = "research"          # Historic/cultural research — web search
    DEEP_WORK = "deep_work"        # Draft chapter, create character — deep ReAct


# Quick edit actions need no reasoning
QUICK_EDIT_ACTIONS = {"rewrite", "shorten", "expand", "describe"}
CONTENT_GEN_ACTIONS = {"continue", "generate"}
DEEP_WORK_ACTIONS = {"outline_plan", "outline_generate", "outline_parse", "outline_section_write", "outline_to_text", "worldbuild_technology", "worldbuild_politics", "worldbuild_economics", "worldbuild_world", "worldbuild_magic", "worldbuild_history", "worldbuild_culture", "worldbuild_rules", "worldbuild_locations", "worldbuild_creatures", "create_character", "character_factual", "character_appearance", "character_personality", "character_background", "character_motivation", "character_voice", "character_notes"}

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

# Factual character fields → quick edit (short, factual responses)
CHARACTER_FACTUAL_FIELDS = {"name", "aliases", "age", "role", "archetype"}
# Creative character fields → content generation
CHARACTER_CREATIVE_FIELDS = {"background", "personality", "appearance", "goals", "conflicts", "voice_description", "notes"}

# Document types that are inherently deep-work
DEEP_WORK_DOC_TYPES = {"outline", "manuscript", "story", "book"}

# Confidence threshold for heuristic classification
HEURISTIC_CONFIDENCE_THRESHOLD = 0.7


def classify_task_heuristic(
    prompt: str,
    action: str | None = None,
    document_type: str | None = None,
    field_name: str | None = None,
    document_title: str | None = None,
    module: str | None = None,
) -> tuple[TaskTier, float]:
    """
    Fast heuristic classification. Returns (tier, confidence).
    Confidence < threshold means the heuristic is unsure — caller should use LLM fallback.
    """
    prompt_lower = prompt.lower().strip()
    words = set(re.findall(r'\b[\w\']+\b', prompt_lower))
    doc_type = (document_type or "").lower()
    field = (field_name or "").lower()
    # document_title and module are available for future heuristic use
    _ = document_title
    _ = module

    # Action-based classification (highest confidence)
    if action:
        if action in QUICK_EDIT_ACTIONS:
            return TaskTier.QUICK_EDIT, 1.0
        if action in CONTENT_GEN_ACTIONS:
            return TaskTier.CONTENT_GEN, 1.0
        if action in DEEP_WORK_ACTIONS:
            return TaskTier.DEEP_WORK, 1.0

    # Document-type / field-based classification (high confidence for known patterns)
    if doc_type == "character":
        if field in CHARACTER_FACTUAL_FIELDS:
            # Editing name, age, role → quick edit (factual, short)
            return TaskTier.QUICK_EDIT, 0.85
        if field in CHARACTER_CREATIVE_FIELDS:
            # Background, personality, goals → content gen (creative, needs context)
            return TaskTier.CONTENT_GEN, 0.75

    if doc_type == "style_guide":
        # Style guide entries are usually concise rules
        if field == "content":
            return TaskTier.QUICK_EDIT, 0.8

    if doc_type == "story_bible":
        # World-building entries need creative context
        if field == "content":
            return TaskTier.CONTENT_GEN, 0.7

    if doc_type == "outline":
        if field == "beat_description":
            return TaskTier.CONTENT_GEN, 0.75
        if field == "outline_content":
            return TaskTier.DEEP_WORK, 0.8

    if doc_type in ("note",):
        return TaskTier.CONTENT_GEN, 0.65

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


_DEFAULT_CLASSIFIER_PROMPT = """You are a task classifier for a novel-writing AI assistant.

Given a user's request, classify it into one of these tiers:
- QUICK_EDIT: Simple text edits (rewrite, shorten, expand, find synonym). No reasoning needed.
- CONTENT_GEN: Continue story, generate prose, apply writing skill. Needs style guide + outline.
- RESEARCH: Research real-world facts (history, culture, names, etymology). Needs web search.
- DEEP_WORK: Complex creative tasks (draft chapter, create character, plan story, consistency check). Needs deep multi-step reasoning.

Current context:
- Document type: {{document_type}}
- Field being edited: {{field_name}}

Rules:
- RESEARCH only if the user is asking about REAL-WORLD facts, history, culture, or authenticity.
- "Continue my story" = CONTENT_GEN, not RESEARCH.
- "Research Victorian London" = RESEARCH.
- "Create a new villain" = DEEP_WORK.
- "Create a character" = DEEP_WORK.
- "Generate character background" = DEEP_WORK.
- "Rewrite this paragraph" = QUICK_EDIT.
- When editing a character's factual field (name, age, role) → QUICK_EDIT.
- When editing a character's creative field (background, personality, goals) → CONTENT_GEN.
- When editing a story bible entry → CONTENT_GEN (needs world consistency).
- When editing a style guide entry → QUICK_EDIT (concise rules).
- When editing an outline beat → CONTENT_GEN.

Respond with JSON only: {"tier": "QUICK_EDIT|CONTENT_GEN|RESEARCH|DEEP_WORK", "confidence": 0.0-1.0}"""


async def classify_task_llm(
    prompt: str,
    provider,
    classifier_prompt: str | None = None,
    template_context: dict | None = None,
) -> tuple[TaskTier, float]:
    """
    LLM-based classification fallback for ambiguous prompts.
    Uses a lightweight call to the reasoning model.
    Renders the classifier prompt with the full template context.
    """
    from app.services.ai.base import Message
    import json

    ctx = {
        "text": prompt,
        "document_type": template_context.get("document_type", "unknown") if template_context else "unknown",
        "field_name": template_context.get("field_name", "unknown") if template_context else "unknown",
        "document_title": template_context.get("document_title", "") if template_context else "",
        "module": template_context.get("module", "") if template_context else "",
        "fullContext": template_context.get("fullContext", "") if template_context else "",
    }

    tmpl = classifier_prompt or _DEFAULT_CLASSIFIER_PROMPT
    system_prompt = render_prompt(tmpl, ctx)

    messages = [
        Message(role="system", content=system_prompt),
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


async def classify_task(
    prompt: str,
    action: str | None = None,
    provider=None,
    classifier_prompt: str | None = None,
    template_context: dict | None = None,
) -> TaskTier:
    """
    Hybrid classifier: heuristic first, LLM fallback if uncertain.
    template_context carries all available prompt variables (document_type,
    field_name, document_title, module, etc.) for rendering classifier prompts.
    """
    document_type = template_context.get("document_type") if template_context else None
    field_name = template_context.get("field_name") if template_context else None
    document_title = template_context.get("document_title") if template_context else None
    module = template_context.get("module") if template_context else None

    tier, confidence = classify_task_heuristic(
        prompt, action, document_type, field_name, document_title, module
    )

    if confidence >= HEURISTIC_CONFIDENCE_THRESHOLD:
        return tier

    # Heuristic is unsure — use LLM if available
    if provider:
        tier, _ = await classify_task_llm(
            prompt, provider,
            classifier_prompt=classifier_prompt,
            template_context=template_context,
        )
        return tier

    # No LLM available, go with heuristic best guess
    return tier
