# /beacon start web

Browser-based learning via the Beacon viewer. The user picks a course in the browser — no course prompt needed from the agent. Agent monitors a shared inbox file and reacts to user actions.

## Startup

Start the relay server (the dashboard is hosted at `https://beacon.jeffsieu.com`):

```bash
beacon serve
```

No local beacon-ui needed — open `https://beacon.jeffsieu.com` in a browser. If running locally, use `http://localhost:5173` instead.

---

## Delegation model

Two modes: **delegated** (spawn subagents for intensive work) or **inline** (all work on main thread). Detect harness capability at startup.

### Task classification

| Task | Delegated? | Reasoning |
|---|---|---|
| Grade a free-text answer | Yes — subagent | LLM-intensive |
| Generate suggestions | Yes — subagent | LLM-intensive |
| Generate lesson | Yes — subagent | LLM-intensive |
| Grade placement batch | Yes — subagent | LLM-intensive |
| Reply to chat | No — inline | Lightweight |
| Handle lesson:finish | No — inline | Mechanical |
| Handle end | No — inline | Cleanup |

### message:ack protocol

For EVERY user-initiated inbox message, ack immediately BEFORE any other work:

```bash
beacon sessions reply <sessionId> --type message:ack --reply-to <user-messageId>
```

Ack for: `chat`, `lesson:answer`, `lesson:suggestion`, `lesson:generate`, `placement:request`, `placement:submit`.
Do NOT ack: `lesson:finish`, `end`, `placement:accept`.

### Delegated mode

1. Ack first.
2. Read template from `prompt-templates/` (grade, generate-suggestions, generate-lesson).
3. Fill `{placeholders}` with actual values.
4. Spawn subagent with `skill: "beacon"`, `cwd` = repo root, `context: "fork"`.
5. Continue monitoring inbox. Subagent pushes results directly.
6. On subagent failure: notify user, don't retry automatically.

### lesson:finish with in-flight subagents

1. Check for active subagents.
2. Wait — keep monitoring inbox.
3. When all complete: sync KNOWLEDGE.md, push `lesson:committed`.
4. If any failed: notify user before merging.

---

## Launch

### 1. Inbox startup check

Check line count to avoid flooding the agent with stale history:

```bash
wc -l .beacon/inbox.jsonl
```

- **0 lines** → proceed directly to monitoring (step 3).
- **1+ lines** → ask user: "Inbox has N messages from previous sessions. Clear or process?"
  - **Clear**: truncate the file and start monitoring from cursor 0.
    ```bash
    beacon inbox clear
    ```
  - **Process**: start monitoring from cursor 0, handling all existing messages normally.

### 2. Open browser

```bash
open "http://localhost:5173"
```

### 3. Monitor inbox

```
file_monitor(path: ".beacon/inbox.jsonl", cursor: 0, waitMs: 30000)
```

Timeout: 15 min cumulative idle time across consecutive polls.

## Session lifecycle

Keep monitoring until `end` message, user says done, or 15 min idle. All messages include `sessionId` — use it for `beacon sessions reply`.

## Inbox message types

| `type` | When | Action |
|---|---|---|
| `lesson:answer` | User submits free-text answer | Ack, grade (delegated or inline) |
| `chat` | User sends chat | Ack, reply directly |
| `lesson:suggestion` | Course page loads, empty cache | Ack, run beacon status, push `lesson:suggestion:success` |
| `lesson:generate` | User clicks a suggestion | Ack, generate lesson, navigate browser |
| `lesson:finish` | User clicks "Finish lesson" | Sync + merge KNOWLEDGE.md, push `lesson:committed` |
| `end` | User ends session | Finalize KNOWLEDGE.md, stop monitoring |
| `placement:request` | Viewer starts placement | Ack, proceed with placement flow |
| `placement:submit` | User submits placement batch | Ack, grade batch |

---

## Grading a free-text answer

When `lesson:answer` arrives: `{ type, questionId, questionTitle, answer, lessonId, courseId, messageId }`.

### Delegated mode

1. Ack.
2. Read `prompt-templates/grade.md`.
3. Fill: `{course}`, `{sessionId}`, `{lessonId}`, `{questionId}`, `{questionTitle}`, `{userAnswer}`, `{itemText}`, `{beaconPath}`.
   - `{itemText}` = verbatim checklist item from KNOWLEDGE.md.
   - `{beaconPath}` = `beacon.ts`
4. Spawn subagent: skill `beacon`, fork context.
5. Subagent pushes events directly.

If answer is too vague: subagent pushes `lesson:answer:clarify` instead of `lesson:answer:success`.

### Inline mode

Push events in sequence:

0. **lesson:answer:clarify** (if needed) — answer too vague. Ask for elaboration, wait for resubmission.

```bash
beacon sessions reply <sessionId> --type lesson:answer:clarify --message-id a0 --reply-to <user-messageId> --course <course> --lesson-id <slug> --question-id kc-1 --feedback "Can you elaborate on..."
```

1. **lesson:answer:success** — renders answer + grade:

```bash
beacon sessions reply <sessionId> --type lesson:answer:success --message-id a1 --reply-to <user-messageId> --course <course> --lesson-id <slug> --question-id kc-1 --question-title "Question" --answer "User's answer" --result CORRECT --feedback "Explanation."
```

2. **lesson:update-pointer** — renders knowledge pointer. `replyTo` MUST be the `lesson:answer:success` messageId:

```bash
beacon sessions reply <sessionId> --type lesson:update-pointer --message-id a2 --reply-to a1 --course <course> --lesson-id <slug> --question-id kc-1 --result LEARNED --item-text "Verbatim item from KNOWLEDGE.md" --feedback "Explanation."
```

3. **lesson:observation** — if bonus/misunderstanding/unknown revealed.

**Message IDs**: sequential short IDs (`a1`, `a2`, `a3`) per grading cycle. Every reply needs a unique `messageId`.

Result mapping: `CORRECT` → `LEARNED`, `PARTIALLY_CORRECT` → `LEARNED_PARTIAL`, `INCORRECT` → `NOT_LEARNED`.

---

## Observations

Push during grading or chat:

```bash
beacon sessions reply <sessionId> --type lesson:observation --message-id o1 --course <course> --lesson-id <slug> --category bonus --text "User demonstrated that..."
```

| `category` | When | Extra flag |
|---|---|---|
| `bonus` | Notable fact not covered by checklist | — |
| `misunderstanding` | User states something INCORRECT | `--status ACTIVE` |
| `unknown` | User explicitly says they don't know a topic | — |

On `lesson:finish`, merge all observations into KNOWLEDGE.md.

---

## Handling `lesson:suggestion`

```bash
beacon status <course>
# Group scored items into 3 lessons

beacon sessions reply <sessionId> --type lesson:suggestion:success --rationale "..." --suggestions '[...]' --chips '[...]'
```

`suggestions` entries: `title`, `description`, `chapters`, `itemCount`.

## Handling `lesson:generate`

1. Ensure `<course>/RESOURCES.md` populated.
2. Generate slug (NEVER guess timestamp):
   ```bash
   beacon slug "<lesson topic>"
   ```
3. Create `.beacon/lessons/<course>/<slug>/LESSON.mdx` — immutable after creation.
   - Frontmatter: `title`, `course`, `lessonId`, `sources`, `knowledgeCheck` (ids `kc-1`, `kc-2`, ...; types `mc`, `tf`, `free-text`).
   - Teaching body: GFM markdown with mermaid diagrams, tables, code blocks. Draw from `RESOURCES.md`.
4. Navigate browser: `http://localhost:5173/<course>/lessons/<lessonId>?sessionId=<sessionId>`

## Handling `lesson:finish`

1. Wait for in-flight grading subagents.
2. `beacon sync <course>`.
3. Update KNOWLEDGE.md with graded items from `lesson-progress.json`.
4. Push (continue monitoring):
   ```bash
   beacon sessions reply <sessionId> --type lesson:committed --course <course> --lesson-id <slug> --summary '[{"item":"...","status":"LEARNED"},...]'
   ```
   `--summary`, `--course`, and `--lesson-id` are compulsory.

## Chat, history, state

```bash
# Reply to chat (MUST reply — UI shows typing indicator until one arrives)
beacon sessions reply <sessionId> --type chat --message-id c1 --reply-to <user-messageId> --content "Response."

# Load conversation history
beacon sessions messages <sessionId> [--limit N]

# Query reading state
beacon sessions state <sessionId>
```

## Ending

When `end` arrives:
1. Merge observations into KNOWLEDGE.md.
2. Finalize open lesson's graded items.
3. Stop monitoring.
4. "Want to do a quick follow-up?"

---

## Placement Test

Triggered via viewer (`/:course/placement`). When `placement:request` arrives:

1. `beacon status <course>`.
2. Scope: fresh course → all chapters; partial → NOT_LEARNED chapters.
3. Push 3–5 questions per chapter, one at a time:
   ```bash
   beacon sessions reply <sessionId> --type placement:question --question '{"id":"pq-1","type":"mc","title":"...","options":["A","B","C","D"]}'
   ```
   Wait for `placement:submit` between batches.

### Grading a batch

```bash
beacon sessions reply <sessionId> --type placement:done --proposed '{"learned":["item text..."],"learnedPartial":[{"item":"text","gaps":["gap"]}],"misunderstandings":["wrong claim"],"bonuses":[]}'
```

### Accepting

When `placement:accept` arrives: update KNOWLEDGE.md, push `placement:committed`.

### Debate

If user argues successfully: push `placement:correction` with revised `--proposed`.

### When to suggest

When KNOWLEDGE.md is entirely NOT_LEARNED: "Want to run a placement test first?"
