# Obsidian Alignment Implementation Tracker

> Branch: `obsidian-alignment`  
> Source: `docs/ObsidianFeatureComparison.md`  
> Date started: 2026-05-04

## Core Design Constraint
Tags are **local to a project** — analogous to an Obsidian vault. There is no global tag namespace across projects.

---

## Phase 1: Link System Foundation ✅ COMPLETE
*Links are now robust, validated, discoverable, and rename-safe.*

- [x] **1.1 Backend: Rename-with-Link-Rewrite Endpoint**
  - `POST /documents/{id}/rename` — updates title and regex-rewrites all `[[Old Title]]` / `[[Old Title|Alias]]` / `[[Old Title#Heading]]` across every `.md` file in the project
  - Files: `backend/app/services/storage/base.py`, `file_storage.py`, `api/v1/documents.py`, `schemas/document.py`

- [x] **1.2 Frontend: Link Validation + Broken Link Styling**
  - Wiki-links validate against existing document titles (including aliases)
  - Broken links render red with strikethrough via `.internal-link[data-broken="true"]`
  - Files: `frontend/src/components/editor/TipTapEditor.tsx`, `index.css`

- [x] **1.3 Frontend: Backlinks Panel**
  - Collapsible "Linked Mentions" panel below the editor
  - Scans all project content for references to current document title; shows context snippets
  - Files: New `frontend/src/components/editor/BacklinksPanel.tsx`, integrated into `BookEditor.tsx`, `DocumentEditor.tsx`, `WorldPage.tsx`

- [x] **1.4 Frontend: Outgoing Links Panel**
  - Collapsible "Outgoing Links" panel below the editor
  - Lists all `[[...]]` references in current document; marks broken ones red
  - Files: New `frontend/src/components/editor/OutgoingLinksPanel.tsx`, integrated into `BookEditor.tsx`, `DocumentEditor.tsx`, `WorldPage.tsx`

- [x] **1.5 Frontend: Hover Preview**
  - Hovering over a valid `[[link]]` shows a floating popover with target document's first ~300 characters
  - Files: New `frontend/src/components/editor/HoverPreview.tsx`, integrated into `TipTapEditor.tsx`

- [x] **1.6 Aliases Support**
  - Documents with `aliases: [Name1, Name2]` in frontmatter can be linked via any alias
  - Autocomplete suggests aliases; click resolution maps aliases to canonical document
  - Files: `TipTapEditor.tsx`, `EditorAutocomplete.tsx`, `BookEditor.tsx`, `DocumentEditor.tsx`, `WorldPage.tsx`

---

## Phase 2: Tag System Overhaul ✅ COMPLETE
*Tags are now a first-class navigation and discovery mechanism.*

- [x] **2.1 Frontend: Tag Click → Search Modal**
  - Replaced `console.log('Tag clicked:', tag)` with `TagPageModal` showing all documents containing that tag
  - New: `frontend/src/components/tags/TagPageModal.tsx`
  - Updated: `BookEditor.tsx`, `DocumentEditor.tsx`, `WorldPage.tsx`, `CharactersPage.tsx`, `StoryEnginePage.tsx`, `StyleGuidePage.tsx`, `ProjectDetailPage.tsx`

- [x] **2.2 Backend + Frontend: Full-Text Search**
  - New `GET /documents/project/{project_id}/search?q={query}` endpoint
  - Case-insensitive substring match on title and content; rank: title exact > title contains > content contains
  - Integrated into `GlobalSearchModal` with "Semantic / Text" toggle
  - Files: `backend/app/services/storage/base.py`, `file_storage.py`, `api/v1/documents.py`, `frontend/src/components/search/GlobalSearchModal.tsx`

- [x] **2.3 Frontend: Tag Pane (Popup Button)**
  - Button in project header opens popup showing all project tags as a tree with occurrence counts
  - New: `frontend/src/components/tags/TagPane.tsx`, `frontend/src/hooks/useProjectTagCounts.ts`
  - Updated: `frontend/src/components/projects/ProjectDetailPage.tsx`

- [x] **2.4 Backend + Frontend: Nested Tags**
  - Support `#parent/child` syntax in editor regex, autocomplete, and tag pane tree
  - Files: `TipTapEditor.tsx`, `EditorAutocomplete.tsx`, `TagPane.tsx`

- [x] **2.5 Frontend: Tag Autocomplete Enhancement**
  - Rank recently used tags higher in `#` autocomplete via `useRecentTags` hook
  - File: `frontend/src/components/editor/EditorAutocomplete.tsx`

- [x] **2.6 Backend + Frontend: Unify Frontmatter Tags with Inline Tags**
  - `tags: [draft, needs-review]` in frontmatter treated identically to inline `#draft` / `#needs-review`
  - Extended `GET /projects/{id}/tags` to scan frontmatter `tags` from ALL item types
  - `FrontmatterEditor` already styles `tags` list field with chips
  - Files: `backend/app/api/v1/projects.py`

- [x] **2.7 Frontend: Tag Page**
  - Modal showing all occurrences of a tag across project, grouped by module
  - New: `frontend/src/components/tags/TagPageModal.tsx`

- [x] **2.8 Backend + Frontend: Story Bible Tags Unification**
  - Converted story bible `tags` from comma-separated string to YAML list
  - Normalized on read/write in `file_storage.py`
  - Updated `WorldPage.tsx` tags input to list-of-chips
  - Files: `backend/app/services/storage/file_storage.py`, `frontend/src/components/world/WorldPage.tsx`

---

## Phase 3: Editor Core Enhancements ✅ COMPLETE
*Directly improve the daily writing experience.*

- [x] **3.1 Frontend: Reading Mode**
  - Third toggle state "Reading" — rendered, non-editable, clean styling
  - File: `frontend/src/components/editor/TipTapEditor.tsx`

- [x] **3.2 Frontend: Image Embedding in Editor**
  - Support `![alt](url)` via `@tiptap/extension-image`
  - Add image insert button to toolbar
  - File: `frontend/src/components/editor/TipTapEditor.tsx`

- [x] **3.3 Frontend: Table Editing**
  - Add `@tiptap/extension-table` + row/cell/header extensions
  - Add table insert/formatting buttons
  - File: `frontend/src/components/editor/TipTapEditor.tsx`

- [x] **3.4 Frontend: Toolbar Improvements**
  - Link insert button (creates `[text](url)` or `[[Doc]]`), horizontal rule, hard-break buttons
  - File: `frontend/src/components/editor/TipTapEditor.tsx`

- [x] **3.5 Frontend: Block References `[[Title#^block-id]]`**
  - Extend wiki-link regex to capture `^block-id`
  - Add `data-block-id` attribute to `InternalLink` mark
  - File: `frontend/src/components/editor/TipTapEditor.tsx`, `extensions/InternalLink.ts`

- [x] **3.6 Frontend: File Embeds `![[Title]]`**
  - Transclude linked document content inline as read-only panel
  - New: `frontend/src/components/editor/extensions/FileEmbed.ts`
  - File: `frontend/src/components/editor/TipTapEditor.tsx`

- [x] **3.7 Frontend: Markdown Links `[text](url)`**
  - Add TipTap Mark extension for `<a href="...">` rendering clickable external links
  - New: `frontend/src/components/editor/extensions/ExternalLink.ts`
  - File: `frontend/src/components/editor/TipTapEditor.tsx`

- [x] **3.8 Frontend: Fold Headings**
  - Collapsible headings in Paper mode
  - New: `frontend/src/components/editor/extensions/FoldHeading.ts`
  - File: `frontend/src/components/editor/TipTapEditor.tsx`

---

## Phase 4: Slash Commands + Bricks Module 🔄 PENDING

- [ ] **4.1 Frontend: Slash Command System**
  - Type `/` to trigger command palette for inserting structured blocks
  - New: `frontend/src/components/editor/extensions/SlashCommand.ts`, `SlashCommandMenu.tsx`

- [ ] **4.2 Backend + Frontend: Bricks Module**
  - New project tab "Bricks" for reusable content blocks/snippets/templates
  - Stored in `project_dir/bricks/` as `.md` files
  - New: `frontend/src/components/bricks/BricksPage.tsx`, `backend/app/api/v1/bricks.py`
  - Update: `frontend/src/components/projects/ProjectDetailPage.tsx`

---

## Phase 5: Properties & Frontmatter 🔄 PENDING

- [ ] **5.1 Frontend: New Property Types**
  - Add `date`, `datetime`, `tags` property types to `FrontmatterEditor`
  - File: `frontend/src/components/editor/FrontmatterEditor.tsx`

- [ ] **5.2 Frontend: Required Properties**
  - Allow marking properties as required; show validation state when empty
  - File: `frontend/src/components/editor/FrontmatterEditor.tsx`

- [ ] **5.3 Backend + Frontend: Property-Based Search**
  - `GET /documents/project/{project_id}/search?property=status&value=draft`
  - Structured filter UI in `GlobalSearchModal`
  - Files: `backend/app/services/storage/file_storage.py`, `api/v1/documents.py`, `frontend/src/components/search/GlobalSearchModal.tsx`

---

## Phase 6: Document History 🔄 PENDING

- [ ] **6.1 Backend: Document History**
  - On every update, save timestamped copy to `.fictionforge/history/{project_id}/{doc_id}/{timestamp}.md`
  - Endpoints: `GET /documents/{id}/history`, `POST /documents/{id}/restore`
  - Files: `backend/app/services/storage/base.py`, `file_storage.py`, `api/v1/documents.py`

- [ ] **6.2 Frontend: History UI**
  - History button in editor header opens modal with version list, diff preview, restore button
  - New: `frontend/src/components/editor/HistoryModal.tsx`
  - Update: `BookEditor.tsx`, `DocumentEditor.tsx`, `WorldPage.tsx`

---

## HOLD FOR LATER
- Auto-Generated Graph View
- Local Graph View

## IGNORED (per comparison doc)
Math/LaTeX, Callouts/Admonitions, Undo/Redo, Word Count, Mode Persistence, Outline/TOC Panel, Focus Mode, Typewriter Mode, Folder Explorer, Document Tabs, Pinning, Bookmarks, Recent Files, Breadcrumbs, Search Operators, Quick Switcher, Search in Backlinks.

---

## Files Most Frequently Touched
| File | Phases | Notes |
|------|--------|-------|
| `frontend/src/components/editor/TipTapEditor.tsx` | 1, 2, 3, 4 | Central editor component |
| `frontend/src/components/editor/BookEditor.tsx` | 1, 2, 3, 6 | Writing tab |
| `frontend/src/components/editor/DocumentEditor.tsx` | 1, 2, 3, 6 | Notes tab |
| `frontend/src/components/world/WorldPage.tsx` | 1, 2, 6 | Story Bible tab |
| `frontend/src/components/editor/FrontmatterEditor.tsx` | 2, 5 | Properties panel |
| `backend/app/services/storage/file_storage.py` | 1, 2, 5, 6 | Core storage |
| `backend/app/services/storage/base.py` | 1, 2, 5, 6 | Abstract interface |
| `backend/app/api/v1/documents.py` | 1, 2, 5, 6 | API routes |
| `frontend/src/components/search/GlobalSearchModal.tsx` | 2, 5 | Search UI |

---

## Testing Strategy
- Each phase should include tests in `tests/` for backend logic
- Frontend: manual verification via the UI
- Run existing tests after each phase: `cd tests && PYTHONPATH=../backend ../backend/venv/bin/pytest -v`
