# FictionForge — Progress & Roadmap

## Project Overview

FictionForge is a writer's manuscript management app with integrated AI assistance. It uses a novel file-based storage approach (.md + YAML frontmatter) instead of a traditional database for content, making projects portable and git-friendly.

**Stack:**
- **Backend:** FastAPI + Python 3.12, SQLite (users/auth only), file-based content storage
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + TipTap editor
- **AI Providers:** Anthropic, OpenRouter, Google, Moonshot/Kimi (API keys encrypted with Fernet)
- **Storage:** Each project is a directory; documents are `.md` files with YAML frontmatter

---

## ✅ Completed Features

### Core Manuscript Management
- [x] Project creation, listing, and deletion
- [x] Document CRUD (chapters, scenes, notes, etc.)
- [x] Drag-and-drop document reordering in manuscript tree
- [x] Document editor with rich text (TipTap) + Markdown toggle
- [x] Auto-save with debounce
- [x] Story Bible (world-building entries with categories)
- [x] Character management (profiles, aliases, notes)
- [x] Story Engine (plot beats, arcs)
- [x] Style Guide (author's writing rules)
- [x] Export functionality
- [x] Canvas (visual storyboarding)

### Authentication
- [x] JWT-based auth (login/register)
- [x] Token persistence in localStorage
- [x] Auto-redirect to login on 401

### AI Integration
- [x] Multi-provider AI support (Anthropic, OpenRouter, Google, Moonshot/Kimi)
- [x] API key storage with Fernet encryption
- [x] **Test AI Connection button** in Settings (backend `POST /ai-providers/test/{provider}`)
- [x] **Kimi auth fix** — auto-detects endpoint from key prefix (`sk-kimi-` → `api.kimi.com/coding/v1`)
- [x] **Cursor-aware AI insertion** — quick actions replace selection or insert at cursor
- [x] **Full-height chat sidebar** with conversation memory
- [x] **Slash commands:** `/clear`, `/plan`, `/create`
- [x] **AI document creation flow:**
  - Natural language or `/plan` → AI generates structured JSON plan
  - User confirms → AI generates content per document → calls `POST /documents` for each
  - Progress shown in chat with ⏳/✅ status messages
- [x] **Robust plan detection** — slash commands + whole-word keywords + key phrase detection
- [x] **Flexible AI prompt** — falls back to normal chat if request isn't about document creation
- [x] Per-message Insert buttons for chat responses
- [x] Quick action icons (Continue, Rewrite, Describe, Shorten, Expand)
- [x] Skills system (custom prompt templates)
- [x] **Model capability tags** — All providers expose `capabilities` (reasoning, writing, web_search, vision, coding, long_context)
- [x] **Capability icons in model dropdown** — Custom dropdown with Lucide icons (Brain, Feather, Globe, Eye, Code, ScrollText)

### UI / UX
- [x] Always-visible AI sidebar on all pages
- [x] Collapsible sidebar with dynamic grid layout
- [x] Light/Dark/System theme (persisted to localStorage)
- [x] Font family selection (sans/serif/mono/Atkinson)
- [x] Heading size selection (S/M/L)
- [x] Writing language setting (US/UK/AU English, Chinese, Spanish, etc.)
- [x] Language preference appended to all AI system prompts
- [x] `Shift+Enter` for newline in chat, `Enter` to send

### Reliability Fixes (Recent)
- [x] Added 120s axios timeout to prevent hanging API requests
- [x] Added detailed console logging to document creation flow for debugging
- [x] Replaced fragile `prev.slice(0, -1)` chat message replacement with append-only progress messages
- [x] Added `setLoading` spinner during document content generation
- [x] Better error extraction (handles `detail` as object vs string)

---

## 🏗️ Architecture Notes

### File Storage Layout
```
data/
└── users/
    └── {user_id}/
        └── projects/
            └── {project_id}/
                ├── .project.md          # Project metadata
                ├── manuscript/          # Documents (chapters, scenes, etc.)
                │   ├── chapter-1.md
                │   └── scene-2.md
                ├── story_bible/         # World-building entries
                ├── characters/          # Character profiles
                ├── story_engine/        # Plot beats
                └── style_guide/         # Author's style rules
```

### Critical Configuration
- `ENCRYPTION_KEY` in `backend/.env` **must be stable** across restarts. Fernet generates a random key if missing, corrupting all stored API keys (InvalidToken).

### API Routing
- Frontend `api` instance: `baseURL: '/api/v1'`
- Backend mounts v1 router at `/api/v1` → all routes prefixed with `/api/v1`
- e.g., `POST /documents` in backend → `POST /api/v1/documents` from frontend

### Kimi/Moonshot Provider Logic
- `sk-kimi-*` keys → `https://api.kimi.com/coding/v1` + `User-Agent: KimiCLI/1.0`
- Other `sk-*` keys → `https://api.moonshot.ai/v1`
- Falls back to `reasoning_content` when `content` is empty

### Selection Preservation
- **TipTap editors:** `editorRef` exposes `getSelectionInfo()`, `replaceSelection()`, `insertAtCursor()`
- **Textarea editors:** `textareaSelectionRef` saves `selectionStart/End` on blur

---

## 🔧 Known Issues & Limitations

### Document Creation (Recently Debugged)
- **Status:** Fixed hanging detection + added logging. Root cause was likely infinite axios timeout + no visual feedback during long AI generation.
- **Remaining concern:** If the AI provider itself hangs (not just slow), the 120s timeout will now fire and show an error.
- **To verify:** Open DevTools → Console and try creating documents. Look for `[DocCreate]` and `[AI]` log lines.

### Potential Issues Not Yet Addressed
1. **Duplicate document IDs:** `file_storage.create_document()` sanitizes titles into filenames. Two documents with the same title will overwrite each other silently. Need collision handling (e.g., append `-1`, `-2`).
2. **No content preview during creation:** Generated document content is sent straight to `POST /documents`. The user never sees the text in chat before it's saved. If creation fails after generation, the content is lost.
3. **No abort/timeout for document creation loop:** If doc 1 of 5 fails, the loop continues. Good for resilience, but no way for user to cancel mid-loop.
4. **Chat context pollution:** `generatePlan` uses `buildApiMessages` which includes full `chatMessages` history. Very long chats could exceed token limits.
5. **Style Guide context injection:** Prepends to system message. Could be very large if many entries exist.
6. **No streaming for chat:** All AI responses are complete (blocking). Would be nice to stream token-by-token.
7. **Canvas feature:** Exists but may be underutilized/under-tested.

---

## 📋 Next Items to Work On

### High Priority
- [ ] **Verify document creation works end-to-end** — Test with DevTools open, check console logs, confirm documents appear in manuscript tree
- [x] **Add duplicate title collision handling** ✅ in `file_storage.create_document()` — appends `-1`, `-2`, etc. when filename already exists
- [x] **Preview generated content in chat before saving** ✅ — Each document shows a ~300 char preview in chat before the save attempt
- [x] **Add Cancel button during document creation loop** ✅ — Cancel flag stops loop between documents

### Medium Priority
- [ ] **Streaming AI responses** in chat sidebar (SSE via `/writing/stream`)
- [ ] **Token limit guardrails** — Warn when chat context + prompt exceeds model context window
- [ ] **Better document creation UX** — Show word count, estimated read time in plan preview
- [ ] **Import functionality** — Import existing Markdown/Word files into manuscript
- [ ] **Version history / snapshots** — Save periodic snapshots of documents

### Low Priority / Polish
- [ ] **Keyboard shortcuts** — `Ctrl+K` for AI sidebar focus, `Ctrl+Shift+A` for quick actions
- [ ] **Mobile responsiveness** — Sidebar is unusable on small screens
- [ ] **Offline mode** — Service worker to cache project data locally
- [ ] **Collaboration** — WebSocket-based real-time editing
- [ ] **Custom AI skills marketplace** — Share/import skill templates

### In Progress: Agentic Reasoning Layer
Tiered ReAct framework for smarter AI assistance:
- **Phase 1: Model Capabilities** ✅ — Capability enum + provider model lists + frontend icons
- **Phase 2: Task Classification** ✅ — Hybrid heuristic + LLM classifier, 4 tiers (QUICK_EDIT, CONTENT_GEN, RESEARCH, DEEP_WORK)
- **Phase 3: Context Retrieval** ✅ — `ContextRetriever` fetches relevant docs by tier (style guide, outlines, characters, story bible)
- **Phase 4: Agentic Orchestrator** ✅ — `/writing/agentic` endpoint with deep ReAct loop (plan → fetch → verify → generate)
- **Phase 5: Frontend Integration** ✅ — Reasoning log toggle in sidebar, agentic path for all quick actions + chat
- **Phase 6: Reasoning Model Settings** ✅ — Settings page shows capability tags, reasoning model selector saved to localStorage
- **Phase 7: End-to-end Agentic Pipeline** ✅ — All AI paths (chat, quick actions, skills, plan, document creation) now use `/writing/agentic`
- **Phase 8: Document Citations** ✅ — Backend tracks consulted docs; frontend shows them below assistant responses
- **Phase 9: Research Tier** ✅ — DuckDuckGo web search integrated into RESEARCH tier; no API key required

### Technical Debt
- [x] Add unit tests for task classifier ✅ (12 tests)
- [x] Add unit tests for context retriever ✅ (8 tests)
- [x] Add unit tests for web search tool ✅ (4 tests)
- [x] Add unit tests for token budget ✅ (7 tests)
- [x] **Token limit guardrails** ✅ — `TokenBudget` tracks usage, truncates context if it exceeds model window
- [ ] Add unit tests for `file_storage.py` (especially `_sanitize` collision cases)
- [ ] Add frontend tests for `useAIWriting` hook
- [ ] Consolidate `renderMarkdown` — duplicated between sidebar components
- [ ] Review all `any` types in TypeScript, especially error handling

---

## 🚀 How to Run

```bash
# Backend
cd fictionforge/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# Frontend (dev)
cd fictionforge/frontend
npm run dev

# Build for production
cd fictionforge/frontend
npm run build
cp -r dist/* ../backend/static/
```

---

*Last updated: 2026-04-27*
