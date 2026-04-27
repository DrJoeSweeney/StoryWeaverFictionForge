import json
from app.services.ai.base import Message
from app.services.ai.task_classifier import classify_task, TaskTier
from app.services.ai.context_retriever import ContextRetriever
from app.services.ai.web_search import web_search_tool
from app.services.ai.token_budget import TokenBudget, estimate_message_tokens
from app.services.storage.base import BaseStorage


REASONING_PLANNER_PROMPT = """You are a planning agent for a novel-writing assistant.

The user has made this request:
"{user_prompt}"

Current document context:
{doc_context}

Available project content types:
- style_guide: Author's writing rules and voice preferences
- outlines: Story structure, acts, chapters, beats
- characters: Character profiles, notes, arcs
- story_bible: World-building entries, lore, rules
- documents: Previous chapters/scenes for continuity

Your task: Determine which content is NEEDED to fulfill this request well.
Return JSON only:
{"needs": ["style_guide", "outline_current_act", "character_NAME", "story_bible", "previous_chapter", ...]}

Rules:
- Only include content directly relevant to the request
- Use "character_<name>" for specific characters mentioned
- Use "previous_chapter" for continuity when drafting new chapters
- Be concise. Include at most 5 items."""


REASONING_VERIFIER_PROMPT = """You are verifying that sufficient context has been gathered for a writing task.

User request: "{user_prompt}"

Retrieved content summary:
{context_summary}

Are we ready to generate a high-quality response? Return JSON only:
{"ready": true/false, "missing": ["what else is needed"], "notes": "any constraints or emphasis for the writer"}

If ready=true, the "missing" array should be empty."""


class AgenticOrchestrator:
    def __init__(self, writing_provider, reasoning_provider=None, reasoning_model: str = ""):
        self.writing_provider = writing_provider
        self.reasoning_provider = reasoning_provider or writing_provider
        self.reasoning_model = reasoning_model
        self.reasoning_log: list[dict] = []

    def log(self, step: str, detail: str):
        self.reasoning_log.append({"step": step, "detail": detail})

    async def run(
        self,
        messages: list[Message],
        model: str,
        temperature: float,
        project_id: str | None,
        user_id: str,
        storage: BaseStorage | None,
        action: str | None = None,
        prompt_text: str = "",
        reasoning_model: str = "",
    ) -> dict:
        """
        Main agentic orchestration entry point.
        Returns {"content": str, "reasoning_log": list, "tier": str}
        """
        self.reasoning_log = []

        # Extract prompt text from messages if not provided
        if not prompt_text and messages:
            for m in reversed(messages):
                if m.role == "user":
                    prompt_text = m.content
                    break

        # Determine context window size
        # Default to 128k for most modern models; smaller models override via context_window
        context_window = 128000
        if "haiku" in model.lower() or "8k" in model.lower():
            context_window = 32768
        elif "gpt-4o-mini" in model.lower():
            context_window = 128000

        # 1. Classify task
        tier = await classify_task(prompt_text, action, provider=self.reasoning_provider)
        self.log("classify", f"Classified as: {tier.value}")

        # 2. QUICK_EDIT — bypass reasoning entirely
        if tier == TaskTier.QUICK_EDIT:
            self.log("execute", "Direct LLM call (no reasoning needed)")
            response = await self.writing_provider.complete(
                messages=messages,
                model=model,
                temperature=temperature,
            )
            return {
                "content": response,
                "reasoning_log": self.reasoning_log,
                "tier": tier.value,
            }

        # 3. Need storage for context retrieval
        if not storage or not project_id:
            self.log("execute", "No project context available — falling back to direct call")
            response = await self.writing_provider.complete(
                messages=messages,
                model=model,
                temperature=temperature,
            )
            return {
                "content": response,
                "reasoning_log": self.reasoning_log,
                "tier": tier.value,
            }

        # 4. Fetch context based on tier
        retriever = ContextRetriever(storage)
        context = None

        if tier == TaskTier.CONTENT_GEN:
            self.log("retrieve", "Fetching style guide and outlines...")
            context = await retriever.fetch_for_task(
                project_id=project_id,
                user_id=user_id,
                task_tier=tier,
                prompt=prompt_text,
            )
            extra_context = context.to_prompt_text(max_tokens=4000)
            self.log("retrieve", f"Retrieved {len(context.style_guide)} style entries, {len(context.outlines)} outlines")

        elif tier == TaskTier.RESEARCH:
            self.log("retrieve", "Fetching style guide and story bible for world consistency...")
            context = await retriever.fetch_for_task(
                project_id=project_id,
                user_id=user_id,
                task_tier=tier,
                prompt=prompt_text,
            )
            project_context = context.to_prompt_text(max_tokens=2000)

            # Perform web search
            self.log("search", f"Searching web for: {prompt_text[:80]}...")
            search_results = await web_search_tool.search(prompt_text, max_results=5)
            search_text = web_search_tool.format_for_prompt(search_results)
            self.log("search", f"Found {len(search_results)} search results")

            extra_context = project_context + "\n\n" + search_text

        elif tier == TaskTier.DEEP_WORK:
            # Deep ReAct loop
            self.log("plan", "Planning context needs...")

            # Step 1: Plan what to fetch
            doc_context = "No specific document context"
            if messages and len(messages) > 1:
                # Get system prompt or recent context
                sys_msg = next((m for m in messages if m.role == "system"), None)
                if sys_msg:
                    doc_context = sys_msg.content[:500]

            plan_prompt = REASONING_PLANNER_PROMPT.format(
                user_prompt=prompt_text,
                doc_context=doc_context,
            )
            plan_response = await self.reasoning_provider.complete(
                messages=[
                    Message(role="system", content="You are a planning agent."),
                    Message(role="user", content=plan_prompt),
                ],
                model=reasoning_model or self.reasoning_model,
                temperature=0.3,
                max_tokens=256,
            )

            # Parse plan
            needs = []
            try:
                json_match = __import__('re').search(r'\{[^}]+\}', plan_response)
                if json_match:
                    plan = json.loads(json_match.group())
                    needs = plan.get("needs", [])
            except Exception:
                needs = ["style_guide", "outline", "previous_chapter"]

            self.log("plan", f"Planned needs: {', '.join(needs) if needs else 'none'}")

            # Step 2: Fetch
            self.log("fetch", f"Fetching: {', '.join(needs) if needs else 'default context'}")
            context = await retriever.fetch_by_plan(project_id, user_id, needs)

            # Step 3: Verify readiness
            self.log("verify", "Verifying context sufficiency...")
            context_summary = context.to_prompt_text(max_tokens=2000)
            verify_prompt = REASONING_VERIFIER_PROMPT.format(
                user_prompt=prompt_text,
                context_summary=context_summary[:1500],
            )
            verify_response = await self.reasoning_provider.complete(
                messages=[
                    Message(role="system", content="You are a verification agent."),
                    Message(role="user", content=verify_prompt),
                ],
                model=reasoning_model or self.reasoning_model,
                temperature=0.3,
                max_tokens=256,
            )

            ready = True
            try:
                json_match = __import__('re').search(r'\{[^}]+\}', verify_response)
                if json_match:
                    verdict = json.loads(json_match.group())
                    ready = verdict.get("ready", True)
                    notes = verdict.get("notes", "")
                    if notes:
                        self.log("verify", f"Notes: {notes}")
            except Exception:
                ready = True

            if not ready:
                self.log("verify", "Context insufficient — proceeding with available context")

            extra_context = context.to_prompt_text(max_tokens=16000)
            self.log("retrieve", f"Deep context ready ({len(extra_context)} chars)")

        else:
            extra_context = ""

        # Build consulted docs list
        consulted_docs = context.get_consulted_docs() if context else []

        # 5. Token budgeting — ensure context fits within model's window
        base_tokens = estimate_message_tokens(messages)
        budget = TokenBudget(context_window=context_window, reserve_tokens=2000)
        # Already used by base messages
        budget.used = base_tokens

        if extra_context and not budget.can_fit(extra_context):
            self.log("budget", f"Context too large ({budget.used} base + ~{len(extra_context)//4} context tokens). Truncating...")
            extra_context = budget.allocate(extra_context)
            self.log("budget", f"Truncated to ~{len(extra_context)//4} tokens. Remaining: {budget.remaining()}")
        elif extra_context:
            self.log("budget", f"Base messages: ~{base_tokens} tokens. Context: ~{len(extra_context)//4} tokens. Remaining: {budget.remaining() - len(extra_context)//4}")

        # 6. Inject context into messages
        if extra_context:
            # Find system message or prepend one
            modified_messages = list(messages)
            context_injection = f"\n\n---\n\nRelevant project context:\n{extra_context}"

            system_idx = next((i for i, m in enumerate(modified_messages) if m.role == "system"), -1)
            if system_idx >= 0:
                modified_messages[system_idx] = Message(
                    role="system",
                    content=modified_messages[system_idx].content + context_injection,
                )
            else:
                modified_messages.insert(0, Message(
                    role="system",
                    content="You are a creative writing assistant." + context_injection,
                ))
        else:
            modified_messages = messages

        # 7. Generate with writing model
        self.log("generate", "Generating response with writing model...")
        response = await self.writing_provider.complete(
            messages=modified_messages,
            model=model,
            temperature=temperature,
        )
        self.log("complete", "Done")

        return {
            "content": response,
            "reasoning_log": self.reasoning_log,
            "tier": tier.value,
            "consulted_docs": consulted_docs,
        }
