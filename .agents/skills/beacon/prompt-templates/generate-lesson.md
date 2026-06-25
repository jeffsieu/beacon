# Generate a lesson

You are writing a LESSON.mdx file for a lesson the user selected from suggestions.

## Parameters

- **Course**: {course}
- **Session ID**: {sessionId}
- **Lesson topic**: {topic}
- **Selected items** (the checklist items this lesson covers): {items}
- **Chapters covered**: {chapters}
- **Beacon path**: {beaconPath}

## Before you start

Read `.agents/skills/learn/SKILL.md` for the lesson generation protocol — MDX format, frontmatter schema, knowledge check types, mermaid diagram usage, and the slug+file creation workflow.

## Steps

### 1. Generate the slug

Use the beacon CLI to generate an exact timestamped slug — do NOT guess:

```bash
npx tsx {beaconPath} slug "{topic}"
```

Use the output verbatim as both the folder name and `lessonId`.

### 2. Ensure resources are populated

Read `courses/{course}/RESOURCES.md`. For any chapter covered by this lesson that lacks resources, search for 1–3 high-trust sources and add them to RESOURCES.md under `## Knowledge` before writing the lesson. Never teach from parametric knowledge alone when a resource can be found.

### 3. Write the lesson file

Create the lesson folder and write `LESSON.mdx`:

```bash
mkdir -p .beacon/lessons/{course}/<slug-from-step-1>
```

The LESSON.mdx format:

```mdx
---
title: Lesson title
course: {course}
lessonId: <slug-from-step-1>
knowledgeCheck:
  - id: kc-1
    type: free-text
    title: Question text
  - id: kc-2
    type: mc
    title: Question text
    options:
      - Option A
      - Option B
      - Option C
      - Option D
    correct: Option A
  - id: kc-3
    type: tf
    title: "True or false: ..."
    correct: "True"
sources:
  - title: Source title
    url: https://...
---

## First section

Content with **bold**, *italic*, tables, lists, blockquotes, fenced code blocks, and mermaid diagrams.
```

See SKILL.md for the full MDX specification — question types, formatting rules, and immutability constraint (LESSON.mdx is immutable after creation).

### 4. Navigate the user's browser

Push the lesson ID to a chat message so the viewer knows where to navigate, OR use:

```bash
open "http://localhost:5173/{course}/lessons/<slug-from-step-1>?sessionId={sessionId}"
```

For hosted viewers, the URL is `https://<host>/{course}/lessons/<slug-from-step-1>?sessionId={sessionId}`.

### 5. Push success event

Send a `lesson:generate:success` event:

```bash
npx tsx {beaconPath} sessions reply {sessionId} \
  --type lesson:generate:success \
  --message-id g1 \
  --lesson-id <slug-from-step-1> \
  --title "<lesson-title>" \
  --course {course}
```
