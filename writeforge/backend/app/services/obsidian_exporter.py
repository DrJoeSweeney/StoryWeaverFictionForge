import io
import zipfile
from datetime import datetime


def generate_obsidian_vault(project, documents, characters, story_bibles, outlines):
    zip_buffer = io.BytesIO()
    project_name = project["title"].replace(" ", "_")

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # 00_Meta
        meta_content = f"""---
title: {project["title"]}
genre: {project.get("genre", "Unknown")}
tone: {project.get("tone", "Unknown")}
status: {project.get("status", "active")}
created: {project.get("created_at", "")}
---

# {project["title"]}

{project.get("description", "No description provided.")}

## Project Stats

- **Genre:** {project.get("genre", "Not set")}
- **Tone:** {project.get("tone", "Not set")}
- **Status:** {project.get("status", "active")}
- **Total Documents:** {len(documents)}
- **Total Characters:** {len(characters)}
- **Story Bible Entries:** {len(story_bibles)}
"""
        zf.writestr(f"{project_name}/00_Meta/Project_Overview.md", meta_content)

        # 01_Story_Bible
        categories = {}
        for entry in story_bibles:
            cat = entry.get("category", "Uncategorized")
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(entry)

        for cat, entries in categories.items():
            cat_folder = cat.replace(" ", "_")
            for entry in entries:
                tags = entry.get("tags", "")
                content = f"""---
title: {entry["title"]}
category: {entry.get("category", "")}
tags: [{tags}]
created: {entry.get("created_at", "")}
---

# {entry["title"]}

{entry.get("content", "")}
"""
                zf.writestr(
                    f"{project_name}/01_Story_Bible/{cat_folder}/{entry['title'].replace(' ', '_')}.md",
                    content,
                )

        # 02_Characters
        for char in characters:
            aliases = char.get("aliases", "")
            content = f"""---
name: {char["name"]}
aliases: [{aliases}]
role: {char.get("role", "Unknown")}
archetype: {char.get("archetype", "Unknown")}
age: {char.get("age", "Unknown")}
tags: [character, {char.get("role", "unknown")}]
created: {char.get("created_at", "")}
---

# {char["name"]}

## Basics

- **Role:** {char.get("role", "Unknown")}
- **Archetype:** {char.get("archetype", "Unknown")}
- **Age:** {char.get("age", "Unknown")}
- **Aliases:** {aliases or "None"}

## Appearance

{char.get("appearance", "Not described.")}

## Personality

{char.get("personality", "Not described.")}

## Background

{char.get("background", "Not described.")}

## Goals

{char.get("goals", "Not defined.")}

## Conflicts

{char.get("conflicts", "Not defined.")}

## Voice

{char.get("voice_description", "Not described.")}

## Notes

{char.get("notes", "")}
"""
            zf.writestr(
                f"{project_name}/02_Characters/{char['name'].replace(' ', '_')}.md",
                content,
            )

        # 03_Outline
        for outline in outlines:
            beats_content = ""
            for beat in outline.get("beats", []):
                beats_content += f"\n### {beat['title']}\n\n"
                beats_content += f"- **Act:** {beat.get('act_number', 1)}\n"
                beats_content += f"- **Position:** {beat.get('position', 0)}\n"
                if beat.get("target_word_count"):
                    beats_content += f"- **Target Words:** {beat['target_word_count']}\n"
                beats_content += f"\n{beat.get('description', '')}\n"

            content = f"""---
title: {outline["title"]}
structure_type: {outline.get("structure_type", "Custom")}
created: {outline.get("created_at", "")}
---

# {outline["title"]}

## Structure Type

{outline.get("structure_type", "Custom")}

## Beats
{beats_content}
"""
            zf.writestr(
                f"{project_name}/03_Outline/{outline['title'].replace(' ', '_')}.md",
                content,
            )

        # 04_Manuscript
        for doc in documents:
            if doc.get("doc_type") in ("chapter", "scene"):
                act = "Act_1"
                if doc.get("sort_order", 0) > 10:
                    act = "Act_2"
                if doc.get("sort_order", 0) > 20:
                    act = "Act_3"

                content = f"""---
title: {doc["title"]}
type: {doc.get("doc_type", "chapter")}
word_count: {doc.get("word_count", 0)}
sort_order: {doc.get("sort_order", 0)}
created: {doc.get("created_at", "")}
---

# {doc["title"]}

{doc.get("content", "")}
"""
                zf.writestr(
                    f"{project_name}/04_Manuscript/{act}/{doc['title'].replace(' ', '_')}.md",
                    content,
                )

        # README
        readme = f"""# {project["title"]} - Obsidian Vault

This vault was exported from WriteForge on {datetime.now().strftime("%Y-%m-%d %H:%M")}.

## Structure

- **00_Meta/** - Project overview and metadata
- **01_Story_Bible/** - Worldbuilding, magic systems, history, culture
- **02_Characters/** - Character profiles with links
- **03_Outline/** - Story structure and beat sheets
- **04_Manuscript/** - Chapters and scenes

## Tips

- Use `[[Wiki Links]]` to connect characters, locations, and concepts
- Add tags like `#character` or `#worldbuilding` to organize
- Use Obsidian's graph view to visualize connections
"""
        zf.writestr(f"{project_name}/README.md", readme)

    zip_buffer.seek(0)
    return zip_buffer.getvalue()
