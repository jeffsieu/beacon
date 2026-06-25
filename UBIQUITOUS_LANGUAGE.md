# Ubiquitous Language — Beacon Learning System

## Curriculum

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Course** | A subject domain being studied — lives at `courses/<author>/<name>/`, identified by its `id` in `course.json` (format: `author/name`) | Topic _(avoid — see Flagged ambiguities)_ |
| **Course ID** | The stable identity of a course — npm-style scoped name (`author/course-name`), stored in `course.json` as `"id"`. Used as the key for progress (`progress/<id>/`) and the lockfile. Renaming the folder does not affect the id. | — |
| **Chapter** | A named subdivision of a course's curriculum; a `.md` file in the course folder containing a checklist | Module, unit, section |
| **Checklist item** | A single concrete concept or skill within a chapter; the atomic unit of progress | Knowledge item, skill, point |
| **Curriculum** | The complete set of chapter files that define what should be learned for a course | Syllabus |

## Progress state

| Term | Definition | Aliases to avoid |
|---|---|---|
| **KNOWLEDGE.md** | The per-course progress file under `progress/<course-id>/`; a mirror of the curriculum with per-item status | Progress file |
| **LEARNED** | Status: the learner fully and precisely demonstrated understanding of a checklist item | Completed, done, known |
| **NOT_LEARNED** | Status: a checklist item not yet demonstrated; the default state | Unknown, unlearned, pending |
| **LEARNED_PARTIAL** | Status: directionally correct but missing key mechanism or detail; has subpointers | Partial, in-progress |
| **Subpointer** | A child entry under a LEARNED_PARTIAL item, each with its own status (LEARNED / NOT_LEARNED / MISUNDERSTANDING) | Sub-item, note |
| **Misunderstanding** | A false claim the learner actively stated; tracked with ACTIVE/CLEARED status | Misconception, error |
| **Bonus** | A fact the learner demonstrated that is not directly covered by any checklist item | Bonus, extra |

## Sessions and delivery

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Session** | One learning interaction instance — either a lesson session or a placement session; has a `sessionId` | Learning session _(context-dependent — qualify: lesson / placement)_ |
| **Lesson** | A generated MDX teaching document stored in `.beacon/lessons/<course-id>/<slug>/LESSON.mdx`; progress tracked in `lesson-progress.json` | Tutorial, article, page |
| **Knowledge Check** | A set of questions at the end of a lesson used to verify understanding of checklist items | Quiz, test, assessment |
| **Placement Test** | A batch-graded test that calibrates existing knowledge for a course; can run at any time | Onboarding Quiz _(retired)_, pre-assessment, diagnostic |
| **Terminal mode** | Learning delivery via back-and-forth Claude Code chat; no browser required | Chat mode |
| **Browser mode** | Learning delivery via the viewer app; Claude generates a lesson file and monitors the inbox | HTML mode _(avoid — legacy)_ |

## Infrastructure

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Relay server** | The `beacon-server.js` Node.js process that bridges the viewer and Claude via HTTP/SSE | Backend, server |
| **Viewer** | The Vite + React browser app at `.agents/skills/learn/.beacon-viewer/`; the learner-facing UI | Frontend, client, app |
| **Inbox** | A shared `.jsonl` file (`.beacon/inbox.jsonl`) that receives messages from all viewer sessions; the agent reads it via `file_monitor` | Message queue, event log |

| **SSE** | Server-sent events stream from relay server to viewer; the push channel for Claude → browser messages | WebSocket, push channel |
| **beacon status** | CLI command (`beacon status <course-id>`) that outputs progress, scored pointers, and chapter summaries as YAML | — |
| **beacon progress** | CLI command (`beacon progress <course-id>`) that outputs progress-only YAML for a course | — |

## Delegation

| Term | Definition | Aliases to avoid |
|---|---|---|
| **Subagent** | A delegated agent session spawned by the main agent for LLM-intensive tasks (grading, lesson generation). Pushes results directly to the relay server. | Child agent, delegate |
| **Delegation** | The pattern of spawning a **Subagent** for intensive work so the main agent continues monitoring the **Inbox**. | Offloading, spawning |
| **Prompt template** | A reusable markdown file in `prompt-templates/` that the main agent fills with parameters and passes to a **Subagent** as its task. One per job type (e.g. `grade.md`, `generate-lesson.md`). | Task template |

## Events

| Term | Definition | Direction |
|---|---|---|
| `placement:request` | Sent to the session inbox when the viewer starts a placement test | Browser → Claude (inbox) |
| `placement-question` | Claude pushes one question to the viewer | Claude → viewer (SSE) |
| `placement:submit` | Browser sends a batch of answers for the current question batch | Browser → Claude (inbox) |
| `placement:done` | Claude pushes the proposed result set after all batches are graded | Claude → viewer (SSE) |
| `placement:accept` | Browser sends user's acceptance of the proposed results | Browser → Claude (inbox) |
| `placement:committed` | Claude confirms KNOWLEDGE.md has been written | Claude → viewer (SSE) |
| `placement:correction` | Claude revises the proposed results after debate in sidebar chat | Claude → viewer (SSE) |
| `message:ack` | Sent by the agent immediately when it receives a message that triggers an intensive task; rendered as a read tick on the user's message bubble | Agent → viewer (SSE) |
| `lesson:suggestion` | Sent by the viewer when course page loads with empty suggestions cache; triggers agent to generate lesson suggestions | Browser → agent (inbox) |
| `lesson:suggestion:success` | Pushed by the agent (or subagent) when generating lesson suggestions; appended to chat.jsonl and rendered as a suggestion card bubble in the viewer | Agent → viewer (SSE) |
| `lesson:suggestion:error` | Pushed by the agent when suggestion generation fails | Agent → viewer (SSE) |
| `lesson:generate` | Sent by the viewer when the user selects a lesson suggestion; appended to chat.jsonl and rendered as a user-action bubble | Browser → agent (inbox) |
| `lesson:generate:success` | Pushed by the agent when a LESSON.mdx file is successfully written | Agent → viewer (SSE) |
| `lesson:generate:error` | Pushed by the agent when lesson generation fails | Agent → viewer (SSE) |

## Relationships

- A **Course** has one or more **Chapters**; a **Chapter** has one or more **Checklist items**.
- A **Course** has exactly one **KNOWLEDGE.md** under `progress/<course-id>/`.
- A **Course** is identified by its `id` in `course.json` (format: `author/course-name`) — this is the stable key, not the folder path.
- A **KNOWLEDGE.md** mirrors every **Checklist item** from every **Chapter**, each with a status.
- A **Lesson** covers a subset of **Checklist items** from one or more **Chapters** of a **Course**.
- A **Session** belongs to one **Course**.
- A **Placement Test** runs as a **Session** (type `placement`); a **Lesson** runs as a **Session** (type lesson).
- A **Knowledge Check** belongs to a **Lesson**; a **Placement Test** runs independently of any **Lesson**.
- All **Sessions** share one **Inbox** at `.beacon/inbox.jsonl`; messages are routed by `sessionId`.
- A **Session** may have zero or more active **Subagents** spawned by the agent for delegated tasks.

## Example dialogue

> **Dev:** "When someone opens `/:course/placement`, what exactly starts?"
>
> **Domain expert:** "The viewer sends a `placement:request` to the shared **inbox**. The agent is monitoring via `file_monitor` and picks it up by **sessionId**."
>
> **Dev:** "And the course is identified by its `id` in `course.json`, like `local/aws`, not the folder name?"
>
> **Domain expert:** "Exactly. The `id` is the stable key — `progress/local/aws/KNOWLEDGE.md` and `courses/local/aws/` — folders can be renamed, progress survives."
>
> **Dev:** "Then Claude pushes `placement-question` events — but how many? One at a time or a batch?"
>
> **Domain expert:** "The agent pushes questions one at a time via `placement-question` SSE events, chapter by chapter. The viewer accumulates them. Once the learner answers all visible questions, they hit Continue — that sends a `placement:submit` with the whole batch to the shared **inbox**."
>
> **Dev:** "So the learner answers, submits a batch, waits for more questions, repeats — and eventually Claude sends `placement:done`?"
>
> **Domain expert:** "Exactly. `placement:done` carries the **proposed** result set — which **checklist items** should become LEARNED or LEARNED_PARTIAL. The learner can debate specific items via sidebar chat, which triggers `placement:correction` events. When they're happy, they hit Accept — `placement:accept` goes to the shared **inbox** and the agent writes **KNOWLEDGE.md**."
>
> **Dev:** "What's the difference between `beacon status` and `beacon progress`?"
>
> **Domain expert:** "`beacon status` returns everything — progress state, scored pointers ranked by ZPD priority, and chapter summaries. It's the one-shot command the agent uses before suggesting lessons. `beacon progress` returns only the progress state — a lighter call when the agent just needs to check what's been learned. Both output YAML."

## Flagged ambiguities

- **Topic** — retired term. Canonical term is now **Course**. All new code must use `courseId` (the `id` field from `course.json`, format: `author/course-name`).
- **Session** — covers both lesson sessions (browser mode teaching) and placement sessions. Both share identical infrastructure (inbox, SSE, `sessionId`). Qualify with context when ambiguous: "lesson session" vs "placement session". The `type` field in `meta.json` distinguishes them at runtime.
- **Onboarding Quiz** — retired term. All occurrences in docs should be updated to **Placement Test**. The AGENTS.md section has been updated; check any external docs or comments.
