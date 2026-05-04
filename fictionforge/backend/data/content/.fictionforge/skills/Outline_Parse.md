---
action: outline_parse
category: agentic
context_sources: '[]'
created_at: '2026-05-02T19:53:32.813634'
cross_skill_refs: '[]'
description: Parses a document containing an outline into a structured list of sections.
is_agentic: true
is_locked: true
model: ''
name: Outline Parse
prompt_template: '{{text}}'
specific_documents: '[]'
system_prompt: 'You are a writing assistant. Parse the following document into a structured
  list of sections to write. Return ONLY a JSON array in this exact format:

  [{"title":"Section Title","description":"What this section should contain"}]

  Do not include any markdown formatting, commentary, or explanation — just the raw
  JSON.'
temperature: 0.3
updated_at: '2026-05-02T19:53:32.813634'
variables: '{"text":"","fullContext":""}'
---

Parses a document containing an outline into a structured list of sections.