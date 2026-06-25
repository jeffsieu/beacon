# /beacon start

Start a learning session. Dispatches to web mode (browser viewer + inbox) or terminal mode (agent teaches inline).

## Invocation

| Command | Behaviour |
|---|---|
| `/beacon start` | Ask: web or terminal? Then read the appropriate file. |
| `/beacon start web` | Read `start-web.md`. Launch browser — user picks course in viewer. |
| `/beacon start terminal` | Read `start-terminal.md`. Ask which course, prep, teach. |

If unsure which course to suggest, run `beacon courses list`.

## Step 0 — Remote course check

Run before anything else, regardless of mode:

```bash
beacon courses check <course>
```

- Exit 0 → up to date. Continue.
- Exit 1 → updates available. Ask: "Pull and sync?"
  - Yes: `beacon courses update <course>`
  - No: continue with local version.
- Exit 2 → error. Don't proceed.

## Switching modes mid-session

| From → To | Action |
|---|---|
| Terminal → Web | Start monitoring inbox, open browser. |
| Web → Terminal | Drop inbox monitoring. Run `beacon status <course>`, present suggestions, teach. |
