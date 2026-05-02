import os
import json
import re
import frontmatter
from datetime import datetime


class FileStorage:
    """
    Universal file-based content storage.
    All project data lives as Markdown files with YAML frontmatter.
    SQLite is only used for auth/users/ai-provider-configs.
    """

    def __init__(self, root_path: str):
        self.root_path = os.path.expanduser(root_path)
        os.makedirs(self.root_path, exist_ok=True)
        self.index_path = os.path.join(self.root_path, ".fictionforge", "index.json")
        self.skills_dir = os.path.join(self.root_path, ".fictionforge", "skills")
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        os.makedirs(self.skills_dir, exist_ok=True)
        self._seed_builtin_skills()

    # ── helpers ──────────────────────────────────────────────────────────

    def _seed_builtin_skills(self):
        """Seed built-in agentic skills if they don't exist."""
        builtins = [
            {
                "name": "Outline Plan",
                "description": "Creates a plan for an outline or structure based on world, characters, and story context.",
                "category": "agentic",
                "system_prompt": "You are a creative writing assistant specializing in story structure and outlining.\n\nThe user wants to create an outline or structure for their current document. Your task is to analyze their request and the available project context, then present a clear, well-reasoned plan for the outline/structure.\n\nConsider the following when making your plan:\n- World-building and setting details (from story bible)\n- Character arcs, relationships, and development needs\n- Existing story plans or outlines\n- Narrative structure appropriate for the genre and content\n- Pacing and dramatic tension\n\nPresent your plan in a clear format with:\n1. An overview of the proposed structure\n2. A breakdown of each section/part with title and brief description of what it should contain\n3. Rationale for why this structure works for the story\n\nDo NOT write the actual outline yet — just present the plan. Ask the user if they approve or want changes.",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "outline_plan",
                "context_sources": '["style_guide","characters","story_bible","outlines","documents"]',
                "specific_documents": "[]",
                "cross_skill_refs": '["outline_generate"]',
                "is_agentic": True,
                "is_locked": True,
                "is_quick_action": False,
                "icon": "",
                "temperature": 0.8,
                "model": "",
            },
            {
                "name": "Outline Generate",
                "description": "Generates a full outline with detailed descriptions and suggested word counts per section.",
                "category": "agentic",
                "system_prompt": "You are a creative writing assistant specializing in story structure.\n\nYou have already presented and received approval for a plan. Now, generate the COMPLETE outline/structure based on this plan. For each section, provide:\n1. The section title/heading\n2. A detailed description of what should be written in that section — sufficient detail for a writer or AI to later flesh it out\n3. A suggested word count for the section, based on its importance and complexity\n\nFormat the outline clearly using markdown headings and bullet points. Make it detailed and actionable.",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "outline_generate",
                "context_sources": '["style_guide","characters","story_bible","outlines"]',
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": True,
                "is_locked": True,
                "is_quick_action": False,
                "icon": "",
                "temperature": 0.8,
                "model": "",
            },
            {
                "name": "Outline Parse",
                "description": "Parses a document containing an outline into a structured list of sections.",
                "category": "agentic",
                "system_prompt": "You are a writing assistant. Parse the following document into a structured list of sections to write. Return ONLY a JSON array in this exact format:\n[{\"title\":\"Section Title\",\"description\":\"What this section should contain\"}]\nDo not include any markdown formatting, commentary, or explanation — just the raw JSON.",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "outline_parse",
                "context_sources": "[]",
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": True,
                "is_locked": True,
                "is_quick_action": False,
                "icon": "",
                "temperature": 0.3,
                "model": "",
            },
            {
                "name": "Outline Section Write",
                "description": "Writes the prose for a single section of an outline, using project context and previously written text.",
                "category": "agentic",
                "system_prompt": "You are a creative writing assistant.\n\nYou are writing a section of a larger document based on an outline. Write the complete prose for this section only.\n\nRules:\n- Write fully fleshed-out prose, not summaries or notes\n- Match the tone and style of any existing text\n- Use the provided world-building, character, and style information\n- Do not include meta-commentary or explanations\n- Do not repeat information from previous sections unless necessary for continuity\n- Write naturally and engagingly",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\",\"previousText\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "outline_section_write",
                "context_sources": '["style_guide","characters","story_bible","outlines","documents"]',
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": True,
                "is_locked": True,
                "is_quick_action": False,
                "icon": "",
                "temperature": 0.8,
                "model": "",
            },
            {
                "name": "Write Outline to Text",
                "description": "Systematically writes out an entire outline into full prose, section by section.",
                "category": "agentic",
                "system_prompt": "You are a creative writing assistant specializing in turning outlines into full prose.\n\nYou will systematically work through an outline and write the complete text chunk by chunk. Use the style guide, world information, notes, and character details to fully write each section.\n\nWrite naturally and engagingly. Maintain continuity between sections.",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "outline_to_text",
                "context_sources": '["style_guide","characters","story_bible","outlines","documents"]',
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": True,
                "is_locked": True,
                "is_quick_action": False,
                "icon": "",
                "temperature": 0.8,
                "model": "",
            },
            {
                "name": "Continue Story",
                "description": "Continues the story naturally from where it left off.",
                "category": "agentic",
                "system_prompt": "You are a creative writing assistant. Continue the story naturally from where it left off. Match the tone and style of the existing text. Write 2-4 paragraphs.\n\nYou are editing: {{documentType}} / {{fieldName}}",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "continue",
                "context_sources": '["style_guide","outlines"]',
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": True,
                "is_locked": True,
                "is_quick_action": True,
                "icon": "ArrowRight",
                "temperature": 0.8,
                "model": "",
            },
            {
                "name": "Rewrite",
                "description": "Rewrites the selected text to improve flow, clarity, and impact while preserving meaning.",
                "category": "agentic",
                "system_prompt": "You are a creative writing assistant. Rewrite the selected text to improve flow, clarity, and impact while preserving the meaning. Maintain the same tone.\n\nYou are editing: {{documentType}} / {{fieldName}}",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "rewrite",
                "context_sources": '["style_guide"]',
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": True,
                "is_locked": True,
                "is_quick_action": True,
                "icon": "RefreshCw",
                "temperature": 0.8,
                "model": "",
            },
            {
                "name": "Describe",
                "description": "Adds vivid sensory details to the selected text.",
                "category": "agentic",
                "system_prompt": "You are a creative writing assistant. Rewrite the selected text with vivid sensory details — sights, sounds, smells, textures, emotions. Make it immersive.\n\nYou are editing: {{documentType}} / {{fieldName}}",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "describe",
                "context_sources": '["style_guide"]',
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": True,
                "is_locked": True,
                "is_quick_action": True,
                "icon": "Type",
                "temperature": 0.8,
                "model": "",
            },
            {
                "name": "Shorten",
                "description": "Makes the selected text more concise without losing meaning or impact.",
                "category": "agentic",
                "system_prompt": "You are a creative writing assistant. Make the selected text more concise without losing meaning or impact. Cut unnecessary words.\n\nYou are editing: {{documentType}} / {{fieldName}}",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "shorten",
                "context_sources": '["style_guide"]',
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": True,
                "is_locked": True,
                "is_quick_action": True,
                "icon": "Zap",
                "temperature": 0.8,
                "model": "",
            },
            {
                "name": "Expand",
                "description": "Expands the selected text with more detail, subtext, and emotional depth.",
                "category": "agentic",
                "system_prompt": "You are a creative writing assistant. Expand the selected text with more detail, subtext, and emotional depth. Add 2-3x the length.\n\nYou are editing: {{documentType}} / {{fieldName}}",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "expand",
                "context_sources": '["style_guide"]',
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": True,
                "is_locked": True,
                "is_quick_action": True,
                "icon": "Sparkles",
                "temperature": 0.8,
                "model": "",
            },
            {
                "name": "Task Classifier",
                "description": "Classifies user requests into task tiers (QUICK_EDIT, CONTENT_GEN, RESEARCH, DEEP_WORK).",
                "category": "orchestrator",
                "system_prompt": "You are a task classifier for a novel-writing AI assistant.\n\nGiven a user's request, classify it into one of these tiers:\n- QUICK_EDIT: Simple text edits (rewrite, shorten, expand, find synonym). No reasoning needed.\n- CONTENT_GEN: Continue story, generate prose, apply writing skill. Needs style guide + outline.\n- RESEARCH: Research real-world facts (history, culture, names, etymology). Needs web search.\n- DEEP_WORK: Complex creative tasks (draft chapter, create character, plan story, consistency check). Needs deep multi-step reasoning.\n\nCurrent context:\n- Document type: {{documentType}}\n- Field being edited: {{fieldName}}\n\nRules:\n- RESEARCH only if the user is asking about REAL-WORLD facts, history, culture, or authenticity.\n- \"Continue my story\" = CONTENT_GEN, not RESEARCH.\n- \"Research Victorian London\" = RESEARCH.\n- \"Create a new villain\" = DEEP_WORK.\n- \"Rewrite this paragraph\" = QUICK_EDIT.\n- When editing a character's factual field (name, age, role) → QUICK_EDIT.\n- When editing a character's creative field (background, personality, goals) → CONTENT_GEN.\n- When editing a story bible entry → CONTENT_GEN (needs world consistency).\n- When editing a style guide entry → QUICK_EDIT (concise rules).\n- When editing an outline beat → CONTENT_GEN.\n\nRespond with JSON only: {\"tier\": \"QUICK_EDIT|CONTENT_GEN|RESEARCH|DEEP_WORK\", \"confidence\": 0.0-1.0}",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\"}",
                "action": "",
                "context_sources": "[]",
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": False,
                "is_locked": True,
                "is_quick_action": False,
                "icon": "",
                "temperature": 0.0,
                "model": "",
            },
            {
                "name": "Reasoning Planner",
                "description": "Plans which project context modules are needed for a DEEP_WORK writing task.",
                "category": "orchestrator",
                "system_prompt": "You are a planning agent for a novel-writing assistant.\n\nThe user has made this request:\n\"{{text}}\"\n\nCurrent document context:\n{{fullContext}}\n\nAvailable project content types:\n- style_guide: Author's writing rules and voice preferences\n- outlines: Story structure, acts, chapters, beats\n- characters: Character profiles, notes, arcs\n- story_bible: World-building entries, lore, rules\n- documents: Previous chapters/scenes for continuity\n\nYour task: Determine which content is NEEDED to fulfill this request well.\nReturn JSON only:\n{\"needs\": [\"style_guide\", \"outline_current_act\", \"character_NAME\", \"story_bible\", \"previous_chapter\", ...]}\n\nRules:\n- Only include content directly relevant to the request\n- Use \"character_<name>\" for specific characters mentioned\n- Use \"previous_chapter\" for continuity when drafting new chapters\n- Be concise. Include at most 5 items.",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\"}",
                "action": "",
                "context_sources": "[]",
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": False,
                "is_locked": True,
                "is_quick_action": False,
                "icon": "",
                "temperature": 0.3,
                "model": "",
            },
            {
                "name": "Reasoning Verifier",
                "description": "Verifies that sufficient context has been gathered before generating a response.",
                "category": "orchestrator",
                "system_prompt": "You are verifying that sufficient context has been gathered for a writing task.\n\nUser request: \"{{text}}\"\n\nRetrieved content summary:\n{{fullContext}}\n\nAre we ready to generate a high-quality response? Return JSON only:\n{\"ready\": true/false, \"missing\": [\"what else is needed\"], \"notes\": \"any constraints or emphasis for the writer\"}\n\nIf ready=true, the \"missing\" array should be empty.",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\"}",
                "action": "",
                "context_sources": "[]",
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": False,
                "is_locked": True,
                "temperature": 0.3,
                "model": "",
            },
            {
                "name": "Fallback System",
                "description": "Default system prompt used when no specific skill system prompt is available.",
                "category": "orchestrator",
                "system_prompt": "You are a creative writing assistant.",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\"}",
                "action": "",
                "context_sources": "[]",
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": False,
                "is_locked": True,
                "is_quick_action": False,
                "icon": "",
                "temperature": 0.8,
                "model": "",
            },
            {
                "name": "Document Plan",
                "description": "Plans new documents, chapters, scenes, or notes for the project.",
                "category": "agentic",
                "system_prompt": "You are a writing assistant helping an author plan new documents.\n\nIf the user's request IS about creating new documents, chapters, scenes, notes, or pages, analyze their request and produce a structured plan.\n\nRespond with a JSON object in this exact format (no markdown code blocks, no extra commentary):\n{\"plan\":\"Brief description of the plan\",\"documents\":[{\"title\":\"Title\",\"description\":\"What this document will contain\",\"doc_type\":\"chapter\"}]}\n\nUse appropriate doc_type values: chapter, prologue, epilogue, note, scene, part, etc.\n\nIf the user's request is NOT about creating documents, just answer their question normally in plain text. Do not force JSON if they are asking a general question.",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"fullContext\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "plan",
                "context_sources": '["style_guide","outlines","documents"]',
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": True,
                "is_locked": True,
                "temperature": 0.8,
                "model": "",
            },
            {
                "name": "Generate Document",
                "description": "Generates complete prose content for a planned document.",
                "category": "agentic",
                "system_prompt": "You are a creative writing assistant.\n\nWrite the complete content for the following document.\n\nTitle: {{title}}\nDescription: {{description}}\n\nWrite the full text as it would appear in the final document. Do not include meta-commentary, outlines, or chapter headings unless they are part of the actual content. Just write the prose.",
                "prompt_template": "{{text}}",
                "variables": "{\"text\":\"\",\"title\":\"\",\"description\":\"\",\"fullContext\":\"\",\"documentType\":\"\",\"fieldName\":\"\"}",
                "action": "draft",
                "context_sources": '["style_guide","characters","story_bible","outlines","documents"]',
                "specific_documents": "[]",
                "cross_skill_refs": "[]",
                "is_agentic": True,
                "is_locked": True,
                "is_quick_action": False,
                "icon": "",
                "temperature": 0.8,
                "model": "",
            },
        ]
        for b in builtins:
            skill_id = self._sanitize(b["name"])
            path = os.path.join(self.skills_dir, f"{skill_id}.md")
            if not os.path.exists(path):
                now = self._now()
                skill_data = {**b, "created_at": now, "updated_at": now, "content": b.get("description", "") or f"# {b['name']}"}
                self._write_md(path, skill_data.copy())

    def _sanitize(self, name: str) -> str:
        s = re.sub(r'[^\w\s-]', '', name).strip().replace(' ', '_')
        return s or 'untitled'

    def _user_dir(self, user_id: str) -> str:
        return os.path.join(self.root_path, "users", self._sanitize(user_id))

    def _project_dir(self, user_id: str, project_id: str) -> str:
        return os.path.join(self._user_dir(user_id), self._sanitize(project_id))

    def _ensure_index(self) -> dict:
        if os.path.exists(self.index_path):
            with open(self.index_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"projects": {}, "version": 1}

    def _save_index(self, index: dict):
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        with open(self.index_path, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2)

    def _read_md(self, path: str) -> dict | None:
        if not os.path.exists(path):
            return None
        post = frontmatter.load(path)
        data = dict(post.metadata)
        data['content'] = post.content
        data['id'] = os.path.splitext(os.path.basename(path))[0]
        if 'created_at' not in data:
            data['created_at'] = datetime.fromtimestamp(os.path.getctime(path)).isoformat()
        if 'updated_at' not in data:
            data['updated_at'] = datetime.fromtimestamp(os.path.getmtime(path)).isoformat()
        return data

    def _write_md(self, path: str, data: dict):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        content = data.pop('content', '')
        post = frontmatter.Post(content, **data)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(frontmatter.dumps(post))

    def _now(self) -> str:
        return datetime.now().isoformat()

    # ── projects ─────────────────────────────────────────────────────────

    async def list_projects(self, user_id: str) -> list[dict]:
        index = self._ensure_index()
        user_projects = index.get("projects", {}).get(user_id, [])
        results = []
        for p in user_projects:
            proj_dir = self._project_dir(user_id, p["id"])
            meta_path = os.path.join(proj_dir, ".project.md")
            if os.path.exists(meta_path):
                data = self._read_md(meta_path)
                if data:
                    data["user_id"] = user_id
                    data["id"] = p["id"]
                    results.append(data)
            else:
                results.append({**p, "user_id": user_id})
        return sorted(results, key=lambda x: x.get("updated_at", ""), reverse=True)

    async def get_project(self, project_id: str, user_id: str) -> dict | None:
        proj_dir = self._project_dir(user_id, project_id)
        meta_path = os.path.join(proj_dir, ".project.md")
        data = self._read_md(meta_path)
        if data:
            data["user_id"] = user_id
            data["id"] = project_id
        return data

    async def create_project(self, user_id: str, data: dict) -> dict:
        project_id = self._sanitize(data.get("title", "Untitled"))
        proj_dir = self._project_dir(user_id, project_id)
        for sub in ["characters", "story-bible", "outlines", "manuscript", "canvas", "style-guide"]:
            os.makedirs(os.path.join(proj_dir, sub), exist_ok=True)

        meta_path = os.path.join(proj_dir, ".project.md")
        now = self._now()
        project_data = {
            "title": data.get("title", "Untitled"),
            "description": data.get("description", ""),
            "genre": data.get("genre", ""),
            "tone": data.get("tone", ""),
            "status": data.get("status", "active"),
            "created_at": now,
            "updated_at": now,
            "content": data.get("description", "") or f"# {data.get('title', 'Untitled')}",
        }
        self._write_md(meta_path, project_data.copy())

        index = self._ensure_index()
        index.setdefault("projects", {}).setdefault(user_id, [])
        index["projects"][user_id] = [p for p in index["projects"][user_id] if p["id"] != project_id]
        index["projects"][user_id].append({"id": project_id, "title": data.get("title", "Untitled")})
        self._save_index(index)
        return {**project_data, "id": project_id, "user_id": user_id}

    async def update_project(self, project_id: str, user_id: str, data: dict) -> dict | None:
        proj_dir = self._project_dir(user_id, project_id)
        meta_path = os.path.join(proj_dir, ".project.md")
        existing = self._read_md(meta_path)
        if not existing:
            return None
        for key, value in data.items():
            existing[key] = value
        existing["updated_at"] = self._now()
        self._write_md(meta_path, existing.copy())
        return {**existing, "id": project_id, "user_id": user_id}

    async def delete_project(self, project_id: str, user_id: str) -> bool:
        import shutil
        proj_dir = self._project_dir(user_id, project_id)
        if not os.path.exists(proj_dir):
            return False
        shutil.rmtree(proj_dir)
        index = self._ensure_index()
        index.setdefault("projects", {}).setdefault(user_id, [])
        index["projects"][user_id] = [p for p in index["projects"][user_id] if p["id"] != project_id]
        self._save_index(index)
        return True

    # ── documents ────────────────────────────────────────────────────────

    async def list_documents(self, project_id: str, user_id: str, parent_id: str | None = None) -> list[dict]:
        manuscript_dir = os.path.join(self._project_dir(user_id, project_id), "manuscript")
        docs = []
        if os.path.exists(manuscript_dir):
            for root, _, files in os.walk(manuscript_dir):
                for f in sorted(files):
                    if f.endswith('.md'):
                        path = os.path.join(root, f)
                        rel = os.path.relpath(path, manuscript_dir)
                        depth = rel.count(os.sep)
                        if parent_id is None and depth == 0:
                            data = self._read_md(path)
                            if data:
                                data["project_id"] = project_id
                                data["parent_id"] = None
                                data["doc_type"] = data.get("doc_type") or "chapter"
                                data["word_count"] = len(data.get("content", "").split())
                                docs.append(data)
                        elif parent_id == os.path.splitext(rel.split(os.sep)[0])[0] and depth == 1:
                            data = self._read_md(path)
                            if data:
                                data["project_id"] = project_id
                                data["parent_id"] = parent_id
                                data["doc_type"] = data.get("doc_type") or "scene"
                                data["word_count"] = len(data.get("content", "").split())
                                docs.append(data)
        return sorted(docs, key=lambda x: x.get("sort_order", 0))

    async def get_document(self, document_id: str, user_id: str) -> dict | None:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                manuscript_dir = os.path.join(self._project_dir(uid, p["id"]), "manuscript")
                for root, _, files in os.walk(manuscript_dir):
                    for f in files:
                        if os.path.splitext(f)[0] == document_id:
                            data = self._read_md(os.path.join(root, f))
                            if data:
                                data["project_id"] = p["id"]
                                data["doc_type"] = "chapter"
                                data["word_count"] = len(data.get("content", "").split())
                            return data
        return None

    async def create_document(self, user_id: str, data: dict) -> dict:
        project_id = data["project_id"]
        manuscript_dir = os.path.join(self._project_dir(user_id, project_id), "manuscript")
        base_doc_id = self._sanitize(data.get("title", "Untitled"))
        doc_id = base_doc_id
        path = os.path.join(manuscript_dir, f"{doc_id}.md")

        # Handle duplicate titles by appending -1, -2, etc.
        counter = 1
        while os.path.exists(path):
            doc_id = f"{base_doc_id}-{counter}"
            path = os.path.join(manuscript_dir, f"{doc_id}.md")
            counter += 1

        now = self._now()
        doc_data = {
            "title": data.get("title", "Untitled"),
            "content": data.get("content", ""),
            "doc_type": data.get("doc_type", "chapter"),
            "sort_order": data.get("sort_order", 0),
            "created_at": now,
            "updated_at": now,
        }
        self._write_md(path, doc_data.copy())
        return {**doc_data, "id": doc_id, "project_id": project_id, "word_count": len(doc_data.get("content", "").split())}

    async def update_document(self, document_id: str, user_id: str, data: dict) -> dict | None:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                manuscript_dir = os.path.join(self._project_dir(uid, p["id"]), "manuscript")
                for root, _, files in os.walk(manuscript_dir):
                    for f in files:
                        if os.path.splitext(f)[0] == document_id:
                            path = os.path.join(root, f)
                            existing = self._read_md(path)
                            if not existing:
                                return None
                            for key, value in data.items():
                                existing[key] = value
                            existing["updated_at"] = self._now()
                            self._write_md(path, existing.copy())
                            return {**existing, "id": document_id, "project_id": p["id"], "word_count": len(existing.get("content", "").split())}
        return None

    async def delete_document(self, document_id: str, user_id: str) -> bool:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                manuscript_dir = os.path.join(self._project_dir(uid, p["id"]), "manuscript")
                for root, _, files in os.walk(manuscript_dir):
                    for f in files:
                        if os.path.splitext(f)[0] == document_id:
                            os.remove(os.path.join(root, f))
                            return True
        return False

    async def reorder_documents(self, project_id: str, user_id: str, document_ids: list[str]) -> bool:
        manuscript_dir = os.path.join(self._project_dir(user_id, project_id), "manuscript")
        if not os.path.exists(manuscript_dir):
            return False
        updated = False
        for sort_order, doc_id in enumerate(document_ids):
            for root, _, files in os.walk(manuscript_dir):
                for f in files:
                    if f.endswith('.md') and os.path.splitext(f)[0] == doc_id:
                        path = os.path.join(root, f)
                        data = self._read_md(path)
                        if data:
                            data['sort_order'] = sort_order
                            self._write_md(path, data)
                            updated = True
                        break
        return updated

    # ── style guide ──────────────────────────────────────────────────────

    async def list_style_guide(self, project_id: str, user_id: str) -> list[dict]:
        sg_dir = os.path.join(self._project_dir(user_id, project_id), "style-guide")
        entries = []
        if os.path.exists(sg_dir):
            for f in sorted(os.listdir(sg_dir)):
                if f.endswith('.md'):
                    data = self._read_md(os.path.join(sg_dir, f))
                    if data:
                        data["project_id"] = project_id
                        data["word_count"] = len(data.get("content", "").split())
                        entries.append(data)
        return entries

    async def create_style_guide(self, user_id: str, data: dict) -> dict:
        project_id = data["project_id"]
        sg_dir = os.path.join(self._project_dir(user_id, project_id), "style-guide")
        entry_id = self._sanitize(data.get("title", "Untitled"))
        path = os.path.join(sg_dir, f"{entry_id}.md")
        now = self._now()
        entry_data = {
            "title": data.get("title", "Untitled"),
            "content": data.get("content", ""),
            "created_at": now,
            "updated_at": now,
        }
        self._write_md(path, entry_data.copy())
        return {**entry_data, "id": entry_id, "project_id": project_id, "word_count": len(entry_data.get("content", "").split())}

    async def update_style_guide(self, entry_id: str, user_id: str, data: dict) -> dict | None:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                sg_dir = os.path.join(self._project_dir(uid, p["id"]), "style-guide")
                path = os.path.join(sg_dir, f"{entry_id}.md")
                if os.path.exists(path):
                    existing = self._read_md(path)
                    if not existing:
                        return None
                    for key, value in data.items():
                        existing[key] = value
                    existing["updated_at"] = self._now()
                    self._write_md(path, existing.copy())
                    return {**existing, "id": entry_id, "project_id": p["id"], "word_count": len(existing.get("content", "").split())}
        return None

    async def delete_style_guide(self, entry_id: str, user_id: str) -> bool:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                sg_dir = os.path.join(self._project_dir(uid, p["id"]), "style-guide")
                path = os.path.join(sg_dir, f"{entry_id}.md")
                if os.path.exists(path):
                    os.remove(path)
                    return True
        return False

    # ── characters ───────────────────────────────────────────────────────

    async def list_characters(self, project_id: str, user_id: str) -> list[dict]:
        chars_dir = os.path.join(self._project_dir(user_id, project_id), "characters")
        chars = []
        if os.path.exists(chars_dir):
            for f in sorted(os.listdir(chars_dir)):
                if f.endswith('.md'):
                    data = self._read_md(os.path.join(chars_dir, f))
                    if data:
                        data["project_id"] = project_id
                        chars.append(data)
        return chars

    async def get_character(self, character_id: str, user_id: str) -> dict | None:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                path = os.path.join(self._project_dir(uid, p["id"]), "characters", f"{character_id}.md")
                data = self._read_md(path)
                if data:
                    data["project_id"] = p["id"]
                    return data
        return None

    async def create_character(self, user_id: str, data: dict) -> dict:
        project_id = data["project_id"]
        chars_dir = os.path.join(self._project_dir(user_id, project_id), "characters")
        char_id = self._sanitize(data.get("name", "Unnamed"))
        path = os.path.join(chars_dir, f"{char_id}.md")
        now = self._now()
        char_data = {
            "name": data.get("name", "Unnamed"),
            "aliases": data.get("aliases", ""),
            "role": data.get("role", "supporting"),
            "archetype": data.get("archetype", ""),
            "age": data.get("age", ""),
            "appearance": data.get("appearance", ""),
            "personality": data.get("personality", ""),
            "background": data.get("background", ""),
            "goals": data.get("goals", ""),
            "conflicts": data.get("conflicts", ""),
            "voice_description": data.get("voice_description", ""),
            "notes": data.get("notes", ""),
            "created_at": now,
            "updated_at": now,
            "content": data.get("background", "") or f"# {data.get('name', 'Unnamed')}",
        }
        self._write_md(path, char_data.copy())
        return {**char_data, "id": char_id, "project_id": project_id}

    async def update_character(self, character_id: str, user_id: str, data: dict) -> dict | None:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                path = os.path.join(self._project_dir(uid, p["id"]), "characters", f"{character_id}.md")
                existing = self._read_md(path)
                if existing:
                    for key, value in data.items():
                        existing[key] = value
                    existing["updated_at"] = self._now()
                    self._write_md(path, existing.copy())
                    return {**existing, "id": character_id, "project_id": p["id"]}
        return None

    async def delete_character(self, character_id: str, user_id: str) -> bool:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                path = os.path.join(self._project_dir(uid, p["id"]), "characters", f"{character_id}.md")
                if os.path.exists(path):
                    os.remove(path)
                    return True
        return False

    async def list_character_history(self, character_id: str, user_id: str) -> list[dict]:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                path = os.path.join(self._project_dir(uid, p["id"]), "characters", f"{character_id}.md")
                data = self._read_md(path)
                if data and "history" in data:
                    return data["history"]
        return []

    async def add_character_history(self, character_id: str, user_id: str, data: dict) -> dict:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                path = os.path.join(self._project_dir(uid, p["id"]), "characters", f"{character_id}.md")
                existing = self._read_md(path)
                if existing:
                    history = existing.get("history", [])
                    entry = {
                        "id": f"{character_id}_hist_{len(history)}",
                        "event_title": data.get("event_title", ""),
                        "event_description": data.get("event_description", ""),
                        "timestamp_in_story": data.get("timestamp_in_story", ""),
                        "created_at": self._now(),
                    }
                    history.append(entry)
                    existing["history"] = history
                    existing["updated_at"] = self._now()
                    self._write_md(path, existing.copy())
                    return entry
        return {}

    # ── story bible ──────────────────────────────────────────────────────

    async def list_story_bible(self, project_id: str, user_id: str, category: str | None = None) -> list[dict]:
        bible_dir = os.path.join(self._project_dir(user_id, project_id), "story-bible")
        entries = []
        if os.path.exists(bible_dir):
            for root, _, files in os.walk(bible_dir):
                for f in files:
                    if f.endswith('.md'):
                        data = self._read_md(os.path.join(root, f))
                        if data:
                            data["project_id"] = project_id
                            if category is None or data.get("category") == category:
                                entries.append(data)
        return sorted(entries, key=lambda x: (x.get("category", ""), x.get("title", "")))

    async def create_story_bible(self, user_id: str, data: dict) -> dict:
        project_id = data["project_id"]
        cat = data.get("category", "general")
        cat_dir = os.path.join(self._project_dir(user_id, project_id), "story-bible", self._sanitize(cat))
        entry_id = self._sanitize(data.get("title", "Untitled"))
        path = os.path.join(cat_dir, f"{entry_id}.md")
        now = self._now()
        entry_data = {
            "title": data.get("title", "Untitled"),
            "category": cat,
            "tags": data.get("tags", ""),
            "created_at": now,
            "updated_at": now,
            "content": data.get("content", ""),
        }
        self._write_md(path, entry_data.copy())
        return {**entry_data, "id": entry_id, "project_id": project_id}

    async def update_story_bible(self, entry_id: str, user_id: str, data: dict) -> dict | None:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                bible_dir = os.path.join(self._project_dir(uid, p["id"]), "story-bible")
                for root, _, files in os.walk(bible_dir):
                    for f in files:
                        if os.path.splitext(f)[0] == entry_id:
                            path = os.path.join(root, f)
                            existing = self._read_md(path)
                            if not existing:
                                return None
                            for key, value in data.items():
                                existing[key] = value
                            existing["updated_at"] = self._now()
                            self._write_md(path, existing.copy())
                            return {**existing, "id": entry_id, "project_id": p["id"]}
        return None

    async def delete_story_bible(self, entry_id: str, user_id: str) -> bool:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                bible_dir = os.path.join(self._project_dir(uid, p["id"]), "story-bible")
                for root, _, files in os.walk(bible_dir):
                    for f in files:
                        if os.path.splitext(f)[0] == entry_id:
                            os.remove(os.path.join(root, f))
                            return True
        return False

    # ── story engine ─────────────────────────────────────────────────────

    async def list_outlines(self, project_id: str, user_id: str) -> list[dict]:
        outline_dir = os.path.join(self._project_dir(user_id, project_id), "outlines")
        outlines = []
        if os.path.exists(outline_dir):
            for f in os.listdir(outline_dir):
                if f.endswith('.md'):
                    data = self._read_md(os.path.join(outline_dir, f))
                    if data:
                        data["project_id"] = project_id
                        data["beats"] = data.get("beats", [])
                        outlines.append(data)
        return outlines

    async def create_outline(self, user_id: str, data: dict) -> dict:
        project_id = data["project_id"]
        outline_dir = os.path.join(self._project_dir(user_id, project_id), "outlines")
        outline_id = self._sanitize(data.get("title", "Untitled"))
        path = os.path.join(outline_dir, f"{outline_id}.md")
        now = self._now()
        outline_data = {
            "title": data.get("title", "Untitled"),
            "structure_type": data.get("structure_type", "custom"),
            "beats": [],
            "created_at": now,
            "updated_at": now,
            "content": data.get("content", "") or f"# {data.get('title', 'Untitled')}\n\n## Structure: {data.get('structure_type', 'custom')}",
        }
        self._write_md(path, outline_data.copy())
        return {**outline_data, "id": outline_id, "project_id": project_id}

    async def update_outline(self, outline_id: str, user_id: str, data: dict) -> dict | None:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                path = os.path.join(self._project_dir(uid, p["id"]), "outlines", f"{outline_id}.md")
                existing = self._read_md(path)
                if existing:
                    for key, value in data.items():
                        if key != "beats":
                            existing[key] = value
                    existing["updated_at"] = self._now()
                    self._write_md(path, existing.copy())
                    return {**existing, "id": outline_id, "project_id": p["id"]}
        return None

    async def delete_outline(self, outline_id: str, user_id: str) -> bool:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                path = os.path.join(self._project_dir(uid, p["id"]), "outlines", f"{outline_id}.md")
                if os.path.exists(path):
                    os.remove(path)
                    return True
        return False

    async def create_beat(self, outline_id: str, user_id: str, data: dict) -> dict:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                path = os.path.join(self._project_dir(uid, p["id"]), "outlines", f"{outline_id}.md")
                existing = self._read_md(path)
                if existing:
                    beats = existing.get("beats", [])
                    beat = {
                        "id": f"{outline_id}_beat_{len(beats)}",
                        "title": data.get("title", ""),
                        "description": data.get("description", ""),
                        "act_number": data.get("act_number", 1),
                        "position": data.get("position", len(beats)),
                        "target_word_count": data.get("target_word_count"),
                        "created_at": self._now(),
                        "updated_at": self._now(),
                    }
                    beats.append(beat)
                    existing["beats"] = beats
                    existing["updated_at"] = self._now()
                    self._write_md(path, existing.copy())
                    return beat
        return {}

    async def update_beat(self, beat_id: str, user_id: str, data: dict) -> dict | None:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                outline_dir = os.path.join(self._project_dir(uid, p["id"]), "outlines")
                for f in os.listdir(outline_dir):
                    if f.endswith('.md'):
                        path = os.path.join(outline_dir, f)
                        existing = self._read_md(path)
                        if existing:
                            beats = existing.get("beats", [])
                            for i, beat in enumerate(beats):
                                if beat.get("id") == beat_id:
                                    for key, value in data.items():
                                        beats[i][key] = value
                                    beats[i]["updated_at"] = self._now()
                                    existing["beats"] = beats
                                    existing["updated_at"] = self._now()
                                    self._write_md(path, existing.copy())
                                    return beats[i]
        return None

    async def delete_beat(self, beat_id: str, user_id: str) -> bool:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                outline_dir = os.path.join(self._project_dir(uid, p["id"]), "outlines")
                for f in os.listdir(outline_dir):
                    if f.endswith('.md'):
                        path = os.path.join(outline_dir, f)
                        existing = self._read_md(path)
                        if existing:
                            beats = existing.get("beats", [])
                            new_beats = [b for b in beats if b.get("id") != beat_id]
                            if len(new_beats) != len(beats):
                                existing["beats"] = new_beats
                                existing["updated_at"] = self._now()
                                self._write_md(path, existing.copy())
                                return True
        return False

    # ── canvas ───────────────────────────────────────────────────────────

    async def list_canvas_nodes(self, project_id: str, user_id: str) -> list[dict]:
        canvas_path = os.path.join(self._project_dir(user_id, project_id), "canvas", "canvas.json")
        if os.path.exists(canvas_path):
            with open(canvas_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get("nodes", [])
        return []

    async def create_canvas_node(self, user_id: str, data: dict) -> dict:
        project_id = data["project_id"]
        canvas_path = os.path.join(self._project_dir(user_id, project_id), "canvas", "canvas.json")
        canvas_data = {"nodes": [], "edges": []}
        if os.path.exists(canvas_path):
            with open(canvas_path, 'r', encoding='utf-8') as f:
                canvas_data = json.load(f)
        node = {
            "id": f"node_{len(canvas_data['nodes'])}",
            "node_type": data.get("node_type", "note"),
            "label": data.get("label", ""),
            "data": data.get("data", ""),
            "position_x": data.get("position_x", 0),
            "position_y": data.get("position_y", 0),
            "width": data.get("width", 200),
            "height": data.get("height", 100),
            "color": data.get("color"),
            "document_id": data.get("document_id"),
            "character_id": data.get("character_id"),
            "created_at": self._now(),
            "updated_at": self._now(),
        }
        canvas_data["nodes"].append(node)
        os.makedirs(os.path.dirname(canvas_path), exist_ok=True)
        with open(canvas_path, 'w', encoding='utf-8') as f:
            json.dump(canvas_data, f, indent=2)
        return {**node, "project_id": project_id}

    async def update_canvas_node(self, node_id: str, user_id: str, data: dict) -> dict | None:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                canvas_path = os.path.join(self._project_dir(uid, p["id"]), "canvas", "canvas.json")
                if os.path.exists(canvas_path):
                    with open(canvas_path, 'r', encoding='utf-8') as f:
                        canvas_data = json.load(f)
                    for i, node in enumerate(canvas_data["nodes"]):
                        if node["id"] == node_id:
                            for key, value in data.items():
                                canvas_data["nodes"][i][key] = value
                            canvas_data["nodes"][i]["updated_at"] = self._now()
                            with open(canvas_path, 'w', encoding='utf-8') as f:
                                json.dump(canvas_data, f, indent=2)
                            return {**canvas_data["nodes"][i], "project_id": p["id"]}
        return None

    async def delete_canvas_node(self, node_id: str, user_id: str) -> bool:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                canvas_path = os.path.join(self._project_dir(uid, p["id"]), "canvas", "canvas.json")
                if os.path.exists(canvas_path):
                    with open(canvas_path, 'r', encoding='utf-8') as f:
                        canvas_data = json.load(f)
                    orig_len = len(canvas_data["nodes"])
                    canvas_data["nodes"] = [n for n in canvas_data["nodes"] if n["id"] != node_id]
                    canvas_data["edges"] = [e for e in canvas_data["edges"] if e.get("source_node_id") != node_id and e.get("target_node_id") != node_id]
                    if len(canvas_data["nodes"]) != orig_len:
                        with open(canvas_path, 'w', encoding='utf-8') as f:
                            json.dump(canvas_data, f, indent=2)
                        return True
        return False

    async def list_canvas_edges(self, project_id: str, user_id: str) -> list[dict]:
        canvas_path = os.path.join(self._project_dir(user_id, project_id), "canvas", "canvas.json")
        if os.path.exists(canvas_path):
            with open(canvas_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get("edges", [])
        return []

    async def create_canvas_edge(self, user_id: str, data: dict) -> dict:
        project_id = data["project_id"]
        canvas_path = os.path.join(self._project_dir(user_id, project_id), "canvas", "canvas.json")
        canvas_data = {"nodes": [], "edges": []}
        if os.path.exists(canvas_path):
            with open(canvas_path, 'r', encoding='utf-8') as f:
                canvas_data = json.load(f)
        edge = {
            "id": f"edge_{len(canvas_data['edges'])}",
            "source_node_id": data.get("source_node_id", ""),
            "target_node_id": data.get("target_node_id", ""),
            "label": data.get("label", ""),
            "edge_type": data.get("edge_type", "related"),
            "created_at": self._now(),
        }
        canvas_data["edges"].append(edge)
        os.makedirs(os.path.dirname(canvas_path), exist_ok=True)
        with open(canvas_path, 'w', encoding='utf-8') as f:
            json.dump(canvas_data, f, indent=2)
        return {**edge, "project_id": project_id}

    async def delete_canvas_edge(self, edge_id: str, user_id: str) -> bool:
        index = self._ensure_index()
        for uid, projects in index.get("projects", {}).items():
            for p in projects:
                canvas_path = os.path.join(self._project_dir(uid, p["id"]), "canvas", "canvas.json")
                if os.path.exists(canvas_path):
                    with open(canvas_path, 'r', encoding='utf-8') as f:
                        canvas_data = json.load(f)
                    orig_len = len(canvas_data["edges"])
                    canvas_data["edges"] = [e for e in canvas_data["edges"] if e["id"] != edge_id]
                    if len(canvas_data["edges"]) != orig_len:
                        with open(canvas_path, 'w', encoding='utf-8') as f:
                            json.dump(canvas_data, f, indent=2)
                        return True
        return False

    # ── skills ───────────────────────────────────────────────────────────

    async def list_skills(self, user_id: str) -> list[dict]:
        skills = []
        if os.path.exists(self.skills_dir):
            for f in sorted(os.listdir(self.skills_dir)):
                if f.endswith('.md'):
                    data = self._read_md(os.path.join(self.skills_dir, f))
                    if data:
                        data["user_id"] = user_id
                        skills.append(data)
        return skills

    async def get_skill(self, skill_id: str, user_id: str) -> dict | None:
        path = os.path.join(self.skills_dir, f"{skill_id}.md")
        data = self._read_md(path)
        if data:
            data["user_id"] = user_id
        return data

    async def create_skill(self, user_id: str, data: dict) -> dict:
        skill_id = self._sanitize(data.get("name", "Untitled"))
        path = os.path.join(self.skills_dir, f"{skill_id}.md")
        now = self._now()
        skill_data = {
            "name": data.get("name", "Untitled"),
            "description": data.get("description", ""),
            "category": data.get("category", "writing"),
            "prompt_template": data.get("prompt_template", ""),
            "system_prompt": data.get("system_prompt", ""),
            "variables": data.get("variables", "{}"),
            "example_input": data.get("example_input", ""),
            "example_output": data.get("example_output", ""),
            "is_global": data.get("is_global", False),
            "is_agentic": data.get("is_agentic", False),
            "is_locked": data.get("is_locked", False),
            "is_quick_action": data.get("is_quick_action", False),
            "icon": data.get("icon", ""),
            "action": data.get("action", ""),
            "context_sources": data.get("context_sources", "[]"),
            "specific_documents": data.get("specific_documents", "[]"),
            "cross_skill_refs": data.get("cross_skill_refs", "[]"),
            "temperature": data.get("temperature", 0.8),
            "model": data.get("model", ""),
            "created_at": now,
            "updated_at": now,
            "content": data.get("description", "") or f"# {data.get('name', 'Untitled')}",
        }
        self._write_md(path, skill_data.copy())
        return {**skill_data, "id": skill_id, "user_id": user_id}

    async def update_skill(self, skill_id: str, user_id: str, data: dict) -> dict | None:
        path = os.path.join(self.skills_dir, f"{skill_id}.md")
        existing = self._read_md(path)
        if not existing:
            return None
        for key, value in data.items():
            existing[key] = value
        existing["updated_at"] = self._now()
        self._write_md(path, existing.copy())
        return {**existing, "id": skill_id, "user_id": user_id}

    async def delete_skill(self, skill_id: str, user_id: str) -> bool:
        path = os.path.join(self.skills_dir, f"{skill_id}.md")
        if os.path.exists(path):
            os.remove(path)
            return True
        return False
