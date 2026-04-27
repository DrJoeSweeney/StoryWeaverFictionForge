# Agentic Reasoning Layer — Implementation Todo

## ✅ Completed

### Phase 1: Model Capabilities
- [x] Add `ModelCapability` enum (`reasoning`, `writing`, `coding`, `vision`, `long_context`, `web_search`)
- [x] Update all providers: OpenRouter, Anthropic, Google, Moonshot
- [x] Frontend custom model dropdown with Lucide capability icons
- [x] `active-models` endpoint returns capabilities

### Phase 2: Task Classification
- [x] `task_classifier.py` with hybrid heuristic + LLM fallback
- [x] 4 tiers: `QUICK_EDIT`, `CONTENT_GEN`, `RESEARCH`, `DEEP_WORK`
- [x] Action-based classification (100% confidence)
- [x] Keyword-based heuristic for free-text prompts
- [x] LLM classifier for ambiguous prompts

### Phase 3: Context Retrieval
- [x] `context_retriever.py` with `RetrievalResult`
- [x] Tier-based fetching: none → style_guide+outlines → everything
- [x] `fetch_by_plan()` for deep ReAct needs-based retrieval
- [x] `to_prompt_text()` with char-based token budgeting
- [x] `get_consulted_docs()` for citations

### Phase 4: Agentic Orchestrator
- [x] `agentic_orchestrator.py` with `AgenticOrchestrator`
- [x] Deep ReAct loop: plan → fetch → verify → generate
- [x] Separate reasoning model support
- [x] Web search integration for RESEARCH tier
- [x] Token budgeting with auto-truncation

### Phase 5: Frontend Integration
- [x] `/writing/agentic` endpoint
- [x] Reasoning log toggle in sidebar (Lightbulb icon)
- [x] Agentic path for chat, quick actions, skills
- [x] Document citations display

### Phase 6: Reasoning Model Settings
- [x] Settings page shows capability tags
- [x] Reasoning model dropdown (localStorage)
- [x] Backend accepts `reasoning_provider` + `reasoning_model`

### Phase 7: End-to-End Pipeline
- [x] `generatePlan` uses `/writing/agentic`
- [x] `generateDocumentContent` uses `/writing/agentic`
- [x] `applySkill` uses `/writing/agentic`

### Phase 8: Document Citations
- [x] Backend tracks consulted docs
- [x] Frontend shows "Consulted: ..." below responses

### Phase 9: Research Tier
- [x] DuckDuckGo web search via `ddgs` package
- [x] No API key required
- [x] Search results formatted for LLM prompt

### Document Creation UX
- [x] Cancel button during creation loop
- [x] Content preview in chat before saving
- [x] Duplicate title collision handling (`-1`, `-2`)

### Tests (31 passing)
- [x] Task classifier (12 tests)
- [x] Context retriever (8 tests)
- [x] Web search (4 tests)
- [x] Token budget (7 tests)

## 🔄 In Progress / Next Up

### High Priority
- [ ] **Verify document creation end-to-end** — Manual test with DevTools
- [ ] **Streaming AI responses** — SSE via `/writing/stream` or `/writing/agentic/stream`
- [ ] **Import functionality** — Markdown/Word files into manuscript

### Medium Priority
- [ ] **Better document creation UX** — Word count, read time in plan preview
- [ ] **Version history / snapshots** — Periodic document backups
- [ ] **Token limit warnings** — Show user when context is near limit

### Low Priority / Polish
- [ ] **Keyboard shortcuts** — `Ctrl+K` for AI sidebar, `Ctrl+Shift+A` for quick actions
- [ ] **Mobile responsiveness** — Sidebar unusable on small screens
- [ ] **Offline mode** — Service worker caching

### Technical Debt
- [ ] Add frontend tests for `useAIWriting` hook
- [ ] Consolidate `renderMarkdown` — duplicated between components
- [ ] Add integration tests for `/writing/agentic` endpoint

## Files Created

```
backend/app/services/ai/task_classifier.py
backend/app/services/ai/context_retriever.py
backend/app/services/ai/agentic_orchestrator.py
backend/app/services/ai/web_search.py
backend/app/services/ai/token_budget.py
tests/test_task_classifier.py
tests/test_context_retriever.py
tests/test_web_search.py
tests/test_token_budget.py
```

## Files Modified

```
backend/app/services/ai/base.py
backend/app/services/ai/openrouter_provider.py
backend/app/services/ai/anthropic_provider.py
backend/app/services/ai/google_provider.py
backend/app/services/ai/moonshot_provider.py
backend/app/api/v1/writing.py
backend/app/services/storage/file_storage.py
frontend/src/hooks/useAIWriting.ts
frontend/src/components/writing/AIWritingSidebar.tsx
frontend/src/components/settings/SettingsPage.tsx
```
