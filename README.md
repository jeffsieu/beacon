# Beacon

An AI-guided learning companion. Beacon turns structured course curricula into interactive, AI-led lessons — your agent teaches, you answer, and your progress is tracked across every concept.

## How it works

```
You (browser)          Agent (Claude, etc.)        Filesystem
    │                       │                         │
    ├─ answer question ──→ inbox.jsonl ──→ agent reads answer
    │                       │                         │
    │                       ├─ grades answer ──→ KNOWLEDGE.md
    │                       │                         │
    │←─── SSE feedback ──── relay server ────────────┘
```

1. **Courses** are markdown chapter files with checklist items — each item is a small, verifiable concept (~5 min).
2. **The agent** monitors a shared inbox file, reads your answers, grades them against the curriculum, and updates your progress.
3. **The viewer** is a browser app that shows lessons, knowledge checks, and a chat sidebar. It connects to a local relay server via SSE.

Progress lives in `progress/<course>/KNOWLEDGE.md` — human-readable, git-trackable.

## Quickstart

### 1. Create a learning folder

```bash
mkdir my-learning && cd my-learning
```

### 2. Install the skill

```bash
npx skills add username/beacon
```

This installs the agent skill, CLI, and relay server into `.agents/skills/beacon/`.

### 3. Add a course

```bash
beacon courses add username/my-course
```

### 4. Start learning

```
/beacon start web
```

Your agent will start the relay server, launch the viewer at `http://localhost:5173`, and begin monitoring for your answers.

## Self-hosting the viewer

If you want to run the viewer locally instead of using the hosted version:

```bash
git clone https://github.com/username/beacon.git
cd beacon/beacon-ui
npm install
npm run dev
```

Then tell your agent: `/beacon start web` — the viewer connects to your local relay server automatically.

## Development

### Project structure

```
beacon/
├── .agents/skills/beacon/    ← Agent skill + CLI (installed via npx skills add)
│   ├── SKILL.md              ← Shared reference + CLI + protocol
│   ├── start.md              ← /beacon start learning flow
│   ├── revise.md             ← /beacon revise spaced repetition
│   ├── start-web.md          ← /beacon start web (browser + inbox)
│   ├── start-terminal.md     ← /beacon start terminal
│   ├── revise.md             ← /beacon revise spaced repetition
│   ├── course.md             ← /beacon create-course interview
│   ├── beacon.js             ← CLI entry point
│   ├── beacon-cli/           ← Subcommands (serve, status, sync, slug, courses)
│   ├── lib/                  ← Shared library (parsing, scoring, checksums)
│   └── prompt-templates/     ← Subagent task templates
├── beacon-ui/                ← React viewer (Vite + shadcn/ui + Tailwind)
│   └── package.json
└── README.md
```

### Running locally

```bash
# Terminal 1 — relay server
cd .agents/skills/beacon && node beacon.js serve

# Terminal 2 — viewer
cd beacon-ui && npm run dev
```

Open `http://localhost:5173`. The viewer auto-connects to the relay server on `localhost:4646`.

### CLI reference

| Command | Description |
|---|---|
| `beacon serve` | Start the relay server (HTTP + SSE) |
| `beacon status <course>` | Show curriculum checksum, progress, and scored items |
| `beacon sync <course>` | Reconcile KNOWLEDGE.md against the current curriculum |
| `beacon slug "<topic>"` | Generate a lesson slug |
| `beacon courses list` | List available courses |
| `beacon courses check <course>` | Check for upstream curriculum updates |
| `beacon courses update <course>` | Pull upstream updates |
| `beacon sessions reply <id> --type ...` | Push events to a viewer session |

## Course format

Courses live in `courses/<author>/<course-name>/`:

```
courses/jeffsieu/ai/
├── course.json              ← { "id": "jeffsieu/ai", "title": "...", "description": "..." }
├── RESOURCES.md             ← Curated learning resources
└── chapter-1-mindset.md     ← Chapter: summary + checklist items
```

Each chapter is a markdown file with a summary at the top and a checklist of ~5-minute learnable items. See `AGENTS.md` for the full format specification.

## License

MIT
