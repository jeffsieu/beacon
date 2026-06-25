# /beacon create-course

Help the user build a high-quality course. Output: `courses/<author>/<course-slug>/` with `course.json` and `chapter-*.md` files. Progress initialisation is handled by `beacon sync` during the first `/beacon start` session.

## What makes good checklist items

Checklist items are **specific, verifiable claims** — not topic headings. Capture non-obvious behaviours, gotchas, and "why does X work this way" moments.

Bad: "Understand React hooks"
Good:
- "Know why the hooks deps array must list every value the effect reads from outer scope"
- "Know why React hooks must be called in the same order on every render (no conditionals, no loops)"
- "Understand what happens when a dependency is missing from the deps array (stale closure)"

Each item ~5 min of focused learning. Broad items must be split.

## Output format

```
courses/<author>/<course-slug>/
├── course.json
└── chapter-<slug>.md
```

### `course.json`

```json
{
  "id": "<author>/<course-slug>",
  "title": "Course Title",
  "description": "One-line description."
}
```

- `<author>`: user's GitHub username if available, otherwise `local`
- The `id` field determines course identity throughout Beacon

### Chapter file

```markdown
# Chapter <N>: <Title>

<One or two sentence summary.>

## Checklist

- <Atomic, verifiable item>
- <Atomic, verifiable item>
```

Rules:
- Filename: `chapter-<slug>.md` — lowercase, hyphen-separated
- No checkboxes in chapter files — progress lives only in KNOWLEDGE.md
- Summary is concise — what the chapter covers, not what the learner will do
- Checklist items start with a verb: "Know", "Understand", "Explain", "Distinguish"

See existing examples in `courses/` — e.g. `courses/local/vietnamese/chapter-1-polite-greetings.md`.

## Interaction flow

### Step 1 — Identify course

Ask for the course name. Confirm author and slug.

### Step 2 — Freeform dump

> "What does someone need to know to truly understand [course]? Don't organise yet — just list everything. Include gotchas, misconceptions, 'why does X work this way' moments, things that trip beginners up."

Probe if shallow:
- "Any gotchas around [area]?"
- "Anything that surprised you when you first learned this?"
- "What would you quiz someone on to tell if they really understand [area] vs just memorised?"

### Step 3 — Propose chapter groupings

Present chapter list with one-line scopes. Iterate until approved.

### Step 4 — Reformat into checklist items

Chapter by chapter. Show splits explicitly when breaking broad items. Get approval per chapter.

### Step 5 — Final preview

All chapters with titles and item counts. Final approval.

### Step 6 — Write files

Write all `course.json` and `chapter-*.md` files. Remind:

> "Run `/beacon start` to begin learning — it will initialise your progress file via `beacon sync`."

## Quality checklist (Step 4)

- [ ] Exactly one testable concept per item
- [ ] Could be answered correctly or incorrectly (not vague)
- [ ] States specific behaviour, not just topic area
- [ ] No duplicates across chapters
- [ ] ~5 min to learn and demonstrate
