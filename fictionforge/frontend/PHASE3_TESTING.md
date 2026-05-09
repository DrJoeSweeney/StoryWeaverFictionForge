# Phase 3 — Manual Testing Checklist

> Test each feature in **Paper mode** unless otherwise noted.

---

## 3.1 Reading Mode

**What to test:** Toggle between Paper / Markdown / Reading. Editor becomes non-editable in Reading.

**Steps:**
1. Open any document with content (headings, paragraphs, tags, links).
2. Click the **Reading** button in the top toolbar (BookOpen icon).
3. **Verify:**
   - Text becomes larger (`prose-lg`).
   - No cursor appears when clicking text.
   - Cannot type or delete.
   - Bottom formatting toolbar is **hidden**.
   - Internal links (`[[Doc]]`) still show hover preview on mouseover.
   - Tags (`#tag`) still show purple highlighting.
4. Click **Paper** to return to editing.
5. **Verify:** cursor returns, toolbar reappears, typing works.

---

## 3.2 Image Embedding

**What to test:** Insert images via URL toolbar button. Round-trip stability (save → reload).

**Steps:**
1. In Paper mode, click the **Image** button (ImageIcon) in bottom toolbar.
2. Enter a valid image URL (e.g., `https://via.placeholder.com/400x200`).
3. **Verify:** image appears inline in the document.
4. Type some text after the image.
5. Switch to **Markdown** view.
6. **Verify:** markdown contains `![alt text](url)` syntax.
7. Switch back to **Paper**.
8. **Verify:** image still renders.
9. Wait for auto-save, then reload the page.
10. **Verify:** image is still present after reload.

---

## 3.3 Table Editing

**What to test:** Insert table, visual appearance, round-trip stability.

**Steps:**
1. Click the **Table** button (TableIcon) in bottom toolbar.
2. **Verify:** a 3-row × 2-column table appears with header row.
3. Type text into various cells.
4. **Verify:** cells have visible borders, header row has darker background.
5. Switch to **Markdown** view.
6. **Verify:** table is present in markdown (TipTap outputs HTML tables; markdown may show raw HTML).
7. Switch back to **Paper**.
8. **Verify:** table content is preserved.

---

## 3.4 Toolbar Improvements

### 3.4a External Link Insert

**Steps:**
1. Click the **Link** button (Link icon) in bottom toolbar.
2. Enter URL: `https://example.com`
3. Enter link text: `Example Site`
4. **Verify:** link appears as blue underlined text.
5. Click the link.
6. **Verify:** opens in a new tab (`target="_blank"`).
7. Switch to **Markdown** view.
8. **Verify:** markdown shows `[Example Site](https://example.com)`.

### 3.4b Horizontal Rule

**Steps:**
1. Click the **Horizontal Rule** button (Minus icon).
2. **Verify:** a horizontal line (`<hr>`) appears.
3. Switch to **Markdown** view.
4. **Verify:** markdown shows `---` or `***`.

### 3.4c Hard Break

**Steps:**
1. Type a line of text.
2. Press the **Hard Break** button (CornerDownLeft icon).
3. **Verify:** cursor moves to next line within same paragraph (no empty line between).
4. Type more text.
5. Switch to **Markdown** view.
6. **Verify:** line ends with two spaces (markdown hard break) or `<br>`.

---

## 3.5 Block References `[[Title#^block-id]]`

**What to test:** Block ID syntax is parsed, rendered, and survives round-trip.

**Steps:**
1. In **Markdown** view, type: `[[Chapter One^paragraph-3]]`
2. Switch to **Paper** view.
3. **Verify:** link renders with internal-link styling.
4. Right-click → Inspect Element on the link.
5. **Verify:** `<a>` has `data-block-id="paragraph-3"` attribute.
6. Switch back to **Markdown**.
7. **Verify:** markdown still shows `[[Chapter One^paragraph-3]]`.
8. Also test with heading + block ID: `[[Chapter One#Waking^paragraph-3]]`
9. **Verify:** `data-heading="Waking"` and `data-block-id="paragraph-3"` both present.

---

## 3.6 File Embeds `![[Title]]`

**What to test:** Document transclusion renders as read-only panel. Broken embeds handled.

**Steps:**
1. In **Markdown** view, type: `![[Chapter One]]` (use an actual document title from your project).
2. Switch to **Paper** view.
3. **Verify:**
   - A panel appears with the embedded document's title and a preview of its content.
   - Panel has border, light background, and "(truncated)" label if content > 800 chars.
   - Content inside panel is rendered markdown (headings, bold, etc.).
4. Click the embed panel.
5. **Verify:** navigates to the embedded document (if `onNavigateToDocument` is wired in BookEditor).
6. In **Markdown** view, type: `![[Nonexistent Document]]`
7. Switch to **Paper**.
8. **Verify:** shows "Broken embed: ![[Nonexistent Document]]" in red.
9. Test toolbar insert:
   - Click **File Embed** button (FileText icon) in toolbar.
   - Enter a document title.
   - **Verify:** embed panel appears immediately.

---

## 3.7 Markdown Links `[text](url)`

**What to test:** External links render, open in new tab, survive round-trip.

**Steps:**
1. In **Markdown** view, type: `[Google](https://google.com)`
2. Switch to **Paper**.
3. **Verify:** link renders as blue underlined text.
4. Click it.
5. **Verify:** opens in new tab.
6. Switch back to **Markdown**.
7. **Verify:** still shows `[Google](https://google.com)`.
8. Also test via toolbar Link button (see 3.4a).

---

## 3.8 Fold Headings

**What to test:** Click chevron to collapse/expand heading content.

**Steps:**
1. Create a document with multiple headings and paragraphs:
   ```
   # Introduction
   This is the intro text.

   ## Chapter One
   Content for chapter one.
   More content here.

   ## Chapter Two
   Content for chapter two.
   ```
2. In **Paper** view, look at each heading.
3. **Verify:** each heading has a small chevron (▼) before it.
4. Click the chevron next to **## Chapter One**.
5. **Verify:**
   - Chevron changes to ▶.
   - All content under "Chapter One" disappears.
   - "Chapter Two" heading is still visible (fold stops at same-or-higher-level heading).
6. Click the chevron again (▶).
7. **Verify:** content reappears, chevron changes back to ▼.
8. Click the chevron next to **# Introduction**.
9. **Verify:** ALL content below Introduction disappears (including Chapter One and Chapter Two).
10. Switch to **Reading** mode.
11. **Verify:** fold toggles still work in Reading mode.

---

## Regression Tests (do these last)

**Steps:**
1. Type `#newtag` anywhere. **Verify:** it highlights purple immediately.
2. Type `/t` and select a tag from the popup. **Verify:** tag inserts correctly, cursor at end of tag.
3. Create `[[Existing Doc]]` link. **Verify:** link is blue, hover shows preview.
4. Create `[[Broken Link]]` link. **Verify:** link is red with strikethrough.
5. Click **Undo / Redo**. **Verify:** works for all new operations (image insert, table insert, embed insert).
6. Switch between Paper / Markdown / Reading rapidly. **Verify:** no crashes, content consistent.
