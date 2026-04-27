import pytest
from app.services.ai.task_classifier import (
    classify_task_heuristic,
    TaskTier,
    QUICK_EDIT_ACTIONS,
    CONTENT_GEN_ACTIONS,
)


class TestTaskClassifierHeuristic:
    def test_quick_edit_action_rewrite(self):
        tier, confidence = classify_task_heuristic("Rewrite this paragraph", action="rewrite")
        assert tier == TaskTier.QUICK_EDIT
        assert confidence == 1.0

    def test_quick_edit_action_shorten(self):
        tier, confidence = classify_task_heuristic("Make this shorter", action="shorten")
        assert tier == TaskTier.QUICK_EDIT
        assert confidence == 1.0

    def test_content_gen_action_continue(self):
        tier, confidence = classify_task_heuristic("Continue from here", action="continue")
        assert tier == TaskTier.CONTENT_GEN
        assert confidence == 1.0

    def test_research_historical_query(self):
        tier, confidence = classify_task_heuristic("Research Victorian London slang")
        assert tier == TaskTier.RESEARCH
        assert confidence >= 0.75

    def test_research_etymology(self):
        tier, confidence = classify_task_heuristic("What is the etymology of the word serendipity?")
        assert tier == TaskTier.RESEARCH
        assert confidence >= 0.75

    def test_deep_work_create_character(self):
        tier, confidence = classify_task_heuristic("Create a new villain character")
        assert tier == TaskTier.DEEP_WORK
        assert confidence >= 0.7

    def test_deep_work_draft_chapter(self):
        tier, confidence = classify_task_heuristic("Draft the next chapter")
        assert tier == TaskTier.DEEP_WORK
        assert confidence >= 0.7

    def test_quick_edit_short_prompt(self):
        tier, confidence = classify_task_heuristic("Rewrite this")
        assert tier == TaskTier.QUICK_EDIT
        assert confidence >= 0.9

    def test_content_gen_fallback(self):
        tier, confidence = classify_task_heuristic("Write more")
        assert tier == TaskTier.CONTENT_GEN
        assert confidence >= 0.5

    def test_research_explicit_command(self):
        tier, confidence = classify_task_heuristic("research medieval weapons")
        assert tier == TaskTier.RESEARCH
        assert confidence >= 0.85

    def test_deep_work_consistency_check(self):
        tier, confidence = classify_task_heuristic("Check for plot holes in my story")
        assert tier == TaskTier.DEEP_WORK

    def test_vague_prompt_defaults_to_content_gen(self):
        tier, confidence = classify_task_heuristic("Hello")
        assert tier == TaskTier.CONTENT_GEN
        assert confidence >= 0.5
