---
name: beacon
description: "AI-guided learning companion. Provides the CLI reference, grading protocol, and KNOWLEDGE.md format shared by all beacon sub-commands. Dispatch to sub-commands: /beacon start, /beacon revise, /beacon create-curriculum."
---

> **CLI alias**: Throughout this skill, `beacon` means the beacon CLI script (`beacon.ts`) invoked via `npx tsx`.
> **Working directory**: All work happens at the repo root.

## Bare invocation (`/beacon`)

When the user runs `/beacon` with no sub-command, present the available actions:

- **Start** — begin a learning session (web or terminal)
- **Revise** — spaced-repetition refresher on previously learned concepts
- **Create course** — interview to build a new course

Ask "What would you like to do?" and dispatch to the appropriate sub-command.

## Sub-command dispatch

| Command | Action |
|---|---|
| `/beacon start` | Ask: web or terminal? Then read the appropriate file. |
| `/beacon start web` | Launch browser session. No course prompt — user picks in viewer. Read `start-web.md`. |
| `/beacon start terminal` | Ask which course, run prep, present suggestions. Read `start-terminal.md`. |
| `/beacon revise` | Spaced-repetition refresher on LEARNED items. Read `revise.md`. |
| `/beacon create-course` | Interview user to build a course. Read `course.md`. |

For any sub-command, read the referenced file before proceeding. This SKILL.md provides the shared infrastructure: CLI commands, file structure, and grading rules.

## File structure

```
courses/<course-id>/
├── course.json           ← { "id": "...", "title": "...", "description": "..." }
├── chapter-*.md          ← chapter files with summary + checklist
└── RESOURCES.md          ← curated resources (Knowledge + Wisdom sections)

.beacon/
├── lessons/<course-id>/<slug>/
│   ├── LESSON.mdx          ← immutable lesson content
│   └── lesson-progress.json ← mutable progress (answers + status)
├── sessions/               ← session state
├── suggestions/            ← cached suggestions
├── inbox.jsonl             ← agent communication (shared across sessions)
└── server.json             ← relay server metadata

progress/<course-id>/
└── KNOWLEDGE.md          ← per-course progress file
```

## CLI reference

| Command | Description |
|---|---|
| `beacon serve [--port N] [--cors-origin URL]` | Start relay server (HTTP + SSE). Default port 4646. |
| `beacon status <course>` | YAML: checksum, progress, scored items, chapter summaries |
| `beacon sync <course>` | Reconcile KNOWLEDGE.md against current curriculum |
| `beacon progress <course>` | Print parsed KNOWLEDGE.md as YAML |
| `beacon slug "<topic>"` | Generate lesson slug: `<YYYY-MM-DDTHHMM>-<topic-slug>` |
| `beacon courses list` | List available courses |
| `beacon courses check <course>` | Check for upstream curriculum updates (exit 1 = updates available) |
| `beacon courses update <course>` | Pull upstream curriculum updates |
| `beacon sessions reply <id> --type ...` | Push event to viewer session |
| `beacon sessions messages <id> [--limit N]` | Pull chat history for a session |
| `beacon sessions state <id>` | Query viewer reading state |

### `beacon status` output

```yaml
checksum:  { stored, current, drift: bool }
progress:  # all items with {text, status, date?, subpointers}
scored:    # NOT_LEARNED + LEARNED_PARTIAL items sorted by ZPD priority
chapters:  # titles, summaries, full item lists per chapter
```

When `drift` is `true`, run `beacon sync <course>` before making progress updates.

### `beacon sessions reply` event types

| --type | Key flags |
|---|---|
| `message:ack` | `--reply-to <user-messageId>` |
| `chat` | `--text`, `--reply-to`, `--message-id` |
| `lesson:answer:success` | `--course`, `--lesson-id`, `--question-id`, `--question-title`, `--answer`, `--result`, `--feedback`, `--reply-to` |
| `lesson:answer:clarify` | `--course`, `--lesson-id`, `--question-id`, `--feedback`, `--reply-to` |
| `lesson:update-pointer` | `--course`, `--lesson-id`, `--question-id`, `--result`, `--item-text`, `--feedback`, `--reply-to` |
| `lesson:observation` | `--course`, `--lesson-id`, `--text`, `--category`, `--status` |
| `lesson:suggestion:success` | `--rationale`, `--suggestions`, `--chips` |
| `lesson:generate:success` | `--title`, `--course`, `--lesson-id` |
| `lesson:committed` | `--course`, `--lesson-id`, `--summary` (all required) |
| `agent:error` | `--text`, `--reply-to` |
| `placement:question` | `--question` (JSON) |
| `placement:done` | `--proposed` (JSON) |
| `placement:correction` | `--proposed` (JSON) |
| `placement:committed` | — |

## KNOWLEDGE.md format

```markdown
[//]: # (curriculum-checksum: <hash>)

## Main Progress

- chapter-slug:
  - LEARNED (YYYY-MM-DD) - Verbatim checklist item text
  - NOT_LEARNED - Verbatim checklist item text
  - LEARNED_PARTIAL (YYYY-MM-DD) - Verbatim checklist item text
    - LEARNED (YYYY-MM-DD) - Specific aspect demonstrated
    - NOT_LEARNED - Specific aspect not demonstrated
    - MISUNDERSTANDING (YYYY-MM-DD to YYYY-MM-DD) - Specific thing stated incorrectly

## Bonuses

- (YYYY-MM-DD) - Notable facts not covered by any checklist item.

## Misunderstandings

- ACTIVE (YYYY-MM-DD to YYYY-MM-DD) - Incorrect claim user made.
- CLEARED (YYYY-MM-DD to YYYY-MM-DD) - Previously active, now corrected.

## Unknown

- (YYYY-MM-DD) - Topic user explicitly stated they don't know.
```

**Checksums** are managed by `beacon sync` and `beacon status` — never compute them manually.

## Grading rules

### Item states

| Internal constant | User-facing name | When to use |
|---|---|---|
| `LEARNED (date)` | Learned | Answer is complete and precise — correct shape + correct mechanism |
| `NOT_LEARNED` | Unlearned | Not demonstrated. **Default — err on this side when in doubt.** |
| `LEARNED_PARTIAL (date)` | Partially learned | Directionally correct but missing key details. Has subpointers. |

### LEARNED_PARTIAL subpointers

Break down what was/wasn't demonstrated:

- `LEARNED (date)` — specific aspect correctly demonstrated
- `NOT_LEARNED` — specific aspect not demonstrated
- `MISUNDERSTANDING (from to)` — specific thing stated incorrectly

When all subpointers reach `LEARNED`, promote parent to `LEARNED` and remove subpointers.

`MISUNDERSTANDING` subpointers → also add to Misunderstandings section.
`NOT_LEARNED` subpointers → also add to Unknown section.

### Lesson grading result mapping

| Answer quality | `lesson:answer:success` result | `lesson:update-pointer` result |
|---|---|---|
| Correct and complete | `CORRECT` | `LEARNED` |
| Directionally correct, missing details | `PARTIALLY_CORRECT` | `LEARNED_PARTIAL` |
| Wrong | `INCORRECT` | `NOT_LEARNED` |

### `lesson:update-pointer.itemText`

Must be the **verbatim** checklist item text from KNOWLEDGE.md — never paraphrase.

### Chapter file format

```markdown
# Chapter <N>: <Title>

<One or two sentence summary of what this chapter covers.>

## Checklist

- <Atomic, verifiable item — one concept, ~5 min>
```

- Filename: `chapter-<slug>.md` — lowercase, hyphen-separated
- No checkboxes (`[ ]`) — progress lives only in KNOWLEDGE.md
- Quoting checklist items verbatim wherever they appear
