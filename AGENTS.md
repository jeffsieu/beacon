# AGENTS.md

This file describes the beacon project for any AI agent working on it.

## What is Beacon?

Beacon is an AI-guided learning companion. It turns structured course curricula (markdown chapter files with checklist items) into interactive, AI-led lessons. A React viewer communicates with an AI agent through a shared inbox + SSE relay server. The agent grades answers, tracks progress in `KNOWLEDGE.md`, and generates lessons on demand.

## Architecture

```
beacon/
├── .agents/skills/beacon/    ← Agent skill + CLI
│   ├── SKILL.md              ← Agent instructions for running sessions
│   ├── start.md              ← /beacon start dispatch
│   ├── start-web.md          ← Browser-based learning flow
│   ├── start-terminal.md     ← Terminal-based learning flow
│   ├── revise.md             ← Spaced-repetition flow
│   ├── course.md             ← Course creation interview
│   ├── beacon.ts             ← CLI entry (thin dispatcher via Optique)
│   ├── beacon-cli/           ← CLI subcommands
│   │   ├── server.ts         ← relay server startup
│   │   ├── server-routes.ts  ← HTTP + SSE route handlers
│   │   ├── courses.ts        ← course management (list, add, check, update)
│   │   ├── status.ts         ← progress/curriculum status
│   │   ├── slug.ts           ← lesson slug generation
│   │   ├── inbox.ts          ← inbox reading commands
│   │   ├── reply.ts          ← session reply/event pushing
│   │   ├── lib.ts            ← parsing, scoring, checksums
│   │   └── util.ts           ← shared utilities
│   └── prompt-templates/     ← Subagent task templates (grading, lesson gen)
├── beacon-ui/                ← React viewer (Vite + shadcn/ui + Tailwind)
│   └── src/
│       ├── App.tsx           ← router (react-router v7)
│       ├── api.ts            ← client-side API + SSE client
│       ├── types.ts          ← shared TypeScript types
│       ├── components/       ← pages + UI components
│       └── hooks/            ← useSession, useCourses, useCourseProgress, etc.
├── .beacon/                  ← Runtime data (gitignored)
│   ├── inbox.jsonl           ← shared inbox (agent ↔ viewer)
│   ├── server.json           ← relay server metadata
│   ├── sessions/             ← per-session chat + state
│   ├── suggestions/          ← cached lesson suggestions
│   └── lessons/              ← generated LESSON.mdx files
├── UBIQUITOUS_LANGUAGE.md    ← Domain terminology (authoritative)
└── README.md                 ← User-facing docs
```

Three layers, each independently testable:

| Layer | Entry | Stack |
|---|---|---|
| **Agent skill** | `.agents/skills/beacon/SKILL.md` | Markdown instructions consumed by the AI agent |
| **CLI** | `.agents/skills/beacon/beacon.ts` | TypeScript, Optique (CLI framework), Hono (HTTP) |
| **Viewer** | `beacon-ui/src/main.tsx` | React 18, Vite 6, shadcn/ui, Tailwind 4, react-router 7 |

## Communication protocol

The agent and viewer communicate through a two-channel system:

```
Viewer ── POST /api/events ──→ inbox.jsonl ── file_monitor ──→ Agent
Agent  ── sessions reply ──→ relay server ── SSE ──→ Viewer
```

- **Inbox** (`.beacon/inbox.jsonl`): The viewer writes events as JSONL lines. The agent monitors this file via `file_monitor`. All viewer sessions share one inbox; messages are routed by `sessionId`.
- **SSE** (relay server): The agent pushes events to the viewer by calling `beacon sessions reply <sessionId> --type ...`. The relay server at `localhost:4646` forwards them as SSE.

Key events are defined in `UBIQUITOUS_LANGUAGE.md` and `SKILL.md`. The `start-web.md` file documents the full session lifecycle.

## Key concepts

All domain terminology lives in `UBIQUITOUS_LANGUAGE.md`. Read it before renaming or introducing concepts. Core terms:

- **Course** — a subject domain, identified by `id` in `course.json` (format: `author/course-name`)
- **Chapter** — an `.md` file with a checklist of ~5-minute learnable items
- **Checklist item** — the atomic unit of progress; quoted verbatim everywhere
- **KNOWLEDGE.md** — per-course progress file mirroring the curriculum
- **Lesson** — a generated MDX document covering a subset of checklist items
- **Session** — a learning interaction (lesson session or placement session)
- **Placement test** — batch-graded test to calibrate existing knowledge
- **Subagent** — a delegated AI session for LLM-intensive tasks (grading, lesson generation)
- **Relay server** — the `beacon serve` HTTP+SSE server bridging agent and viewer

## Development workflow

### Running locally

```bash
# Terminal 1 — relay server
cd .agents/skills/beacon && npx tsx beacon.ts serve

# Terminal 2 — viewer
cd beacon-ui && npm run dev
```

Open `http://localhost:5173`. The viewer auto-connects to `localhost:4646`.

### CLI development

The CLI uses [Optique](https://optique.dev) for command routing. Entry is `beacon.ts` — a thin dispatcher. Subcommands live in `beacon-cli/`.

```bash
# Run a command via tsx
cd .agents/skills/beacon && npx tsx beacon.ts <command> [args...]

# Install deps if module-not-found
cd .agents/skills/beacon && npm install
```

**Key files:**
- `beacon-cli/lib.ts` — shared library: KNOWLEDGE.md parsing, checksum computation, scoring
- `beacon-cli/server.ts` — Hono server startup, middleware, CORS
- `beacon-cli/server-routes.ts` — all HTTP + SSE route handlers
- `beacon-cli/courses.ts` — course add/list/check/update commands
- `beacon-cli/reply.ts` — `sessions reply` command for pushing events to viewers

### Viewer development

The viewer is a standard Vite + React app in `beacon-ui/`.

**Stack:** React 18, react-router v7, shadcn/ui, Tailwind CSS 4, TanStack Query, react-markdown, Mermaid.

**Key files:**
- `src/types.ts` — all TypeScript types shared across the viewer
- `src/api.ts` — API client for the relay server, SSE connection management
- `src/hooks/useSession.tsx` — session state management (the core hook)
- `src/hooks/queries.ts` — TanStack Query hooks for API calls
- `src/components/Sidebar.tsx` — chat sidebar + session management
- `src/components/LessonPage.tsx` — lesson rendering + knowledge checks
- `src/components/PlacementPage.tsx` — placement test flow
- `src/components/Dashboard.tsx` — course dashboard (continue learning, suggestions)

### Agent skill development

The agent skill files in `.agents/skills/beacon/` are Markdown instructions consumed by AI agents. They define:

- **SKILL.md** — shared reference: CLI commands, KNOWLEDGE.md format, grading rules, event protocol
- **start.md** — dispatch logic for `/beacon start`
- **start-web.md** — full browser session lifecycle (startup, inbox monitoring, delegation model, grading flow)
- **start-terminal.md** — terminal-based session flow
- **revise.md** — spaced-repetition refresher
- **course.md** — interview for course creation

When editing skill files, keep them concise and operational — agents follow them step by step. Use the CLI, never reproduce its logic inline.

## File conventions

- **TypeScript**: All CLI code. Use ESM (`"type": "module"`). Strict mode.
- **React**: Functional components with hooks. shadcn/ui components in `components/ui/`.
- **CSS**: Tailwind utility classes. Custom styles in `index.css`.
- **Chapter filenames**: `chapter-<slug>.md` — lowercase, hyphen-separated.
- **Chapter format**: Summary at top, then `## Checklist` with bullet items. No checkboxes — progress lives only in KNOWLEDGE.md.
- **KNOWLEDGE.md**: Checksum header, then Main Progress / Bonuses / Misunderstandings / Unknown sections.

## Guidelines

- Read `UBIQUITOUS_LANGUAGE.md` before renaming or introducing concepts. It is the authoritative glossary.
- Use `beacon status` and `beacon sync` for curriculum checksums — never compute them manually.
- Checklist items must be quoted verbatim wherever they appear (KNOWLEDGE.md, grading results, lesson pointers).
- The `id` in `course.json` is the canonical course identifier, not the folder path.
- Agent skill files are operational instructions for AI — keep them step-by-step, not essay-like.
- Viewer and CLI are separate Node packages with separate `node_modules`. Work in the appropriate directory.
- The relay server is stateless — all state lives in `.beacon/` on disk.
- Do not restructure existing files or directories without being asked.

## Related files

| File | Purpose |
|---|---|
| `UBIQUITOUS_LANGUAGE.md` | Domain glossary — the single source of truth for terminology |
| `README.md` | User-facing docs: what Beacon is, how to use it |
| `.agents/skills/beacon/SKILL.md` | Agent skill reference: CLI, protocol, grading rules |
