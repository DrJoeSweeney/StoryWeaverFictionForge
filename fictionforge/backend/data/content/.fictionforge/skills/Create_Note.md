---
action: create_note
category: writing
context_sources: '["style_guide","story_bible","characters","outlines","documents","notes"]'
created_at: '2026-05-03T21:52:24.115590'
cross_skill_refs: '[]'
description: Creates a new project note from the selected text. The selection becomes
  the note title.
icon: FileText
is_agentic: true
is_locked: true
is_quick_action: true
model: ''
name: Create Note
prompt_template: 'Create a project note about: {{text}}


  Project context:

  {{fullContext}}'
specific_documents: '[]'
system_prompt: 'You are a writing assistant for fiction authors. You help create structured,
  useful project notes.


  The user has selected text that represents a TOPIC, IDEA, QUESTION, or REMINDER
  they want documented as a note.


  Your task:

  1. Use the selected text as the note''s core topic

  2. Generate a well-structured note that expands on the topic

  3. Make it useful for future reference and writing


  ## Output Format

  Return the note content as markdown. Do NOT include meta-commentary.


  Structure:

  - A brief summary/definition of the topic (1 paragraph)

  - Key points, details, or questions to explore (bullet points or paragraphs)

  - Any connections to story elements, characters, or world-building

  - Action items or follow-up questions if relevant


  Tone: practical, concise, but thorough enough to be useful later.'
temperature: 0.8
updated_at: '2026-05-03T21:52:24.115590'
variables: '{"text":"","fullContext":"","documentType":"","fieldName":""}'
---

Creates a new project note from the selected text. The selection becomes the note title.