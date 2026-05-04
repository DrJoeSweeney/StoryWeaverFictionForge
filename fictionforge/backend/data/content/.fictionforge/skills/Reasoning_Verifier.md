---
action: ''
category: orchestrator
context_sources: '[]'
created_at: '2026-05-02T20:08:09.868878'
cross_skill_refs: '[]'
description: Verifies that sufficient context has been gathered before generating
  a response.
is_agentic: false
is_locked: true
model: ''
name: Reasoning Verifier
prompt_template: '{{text}}'
specific_documents: '[]'
system_prompt: 'You are verifying that sufficient context has been gathered for a
  writing task.


  User request: "{{text}}"


  Retrieved content summary:

  {{fullContext}}


  Are we ready to generate a high-quality response? Return JSON only:

  {"ready": true/false, "missing": ["what else is needed"], "notes": "any constraints
  or emphasis for the writer"}


  If ready=true, the "missing" array should be empty.'
temperature: 0.3
updated_at: '2026-05-02T20:08:09.868878'
variables: '{"text":"","fullContext":""}'
---

Verifies that sufficient context has been gathered before generating a response.