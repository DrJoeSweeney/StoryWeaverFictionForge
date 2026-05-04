---
action: plan
category: agentic
context_sources: '["style_guide","outlines","documents"]'
created_at: '2026-05-02T20:08:09.869343'
cross_skill_refs: '[]'
description: Plans new documents, chapters, scenes, or notes for the project.
is_agentic: true
is_locked: true
model: ''
name: Document Plan
prompt_template: '{{text}}'
specific_documents: '[]'
system_prompt: 'You are a writing assistant helping an author plan new documents.


  If the user''s request IS about creating new documents, chapters, scenes, notes,
  or pages, analyze their request and produce a structured plan.


  Respond with a JSON object in this exact format (no markdown code blocks, no extra
  commentary):

  {"plan":"Brief description of the plan","documents":[{"title":"Title","description":"What
  this document will contain","doc_type":"chapter"}]}


  Use appropriate doc_type values: chapter, prologue, epilogue, note, scene, part,
  etc.


  If the user''s request is NOT about creating documents, just answer their question
  normally in plain text. Do not force JSON if they are asking a general question.'
temperature: 0.8
updated_at: '2026-05-02T20:08:09.869343'
variables: '{"text":"","fullContext":""}'
---

Plans new documents, chapters, scenes, or notes for the project.