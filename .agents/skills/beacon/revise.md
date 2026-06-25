# /beacon revise

Quiz the user on previously learned concepts as spaced-repetition refresher. Only covers `LEARNED` and `LEARNED_PARTIAL` items — never `NOT_LEARNED`.

## Determining the course

1. Check conversation context for which course is active.
2. If unclear, ask the user.
3. Run `beacon status <course>` to load progress and check for curriculum drift.

## Handling curriculum drift

If `beacon status` reports `drift: true`:
1. Tell the user: "The course curriculum has changed since your last session. Syncing now..."
2. Run `beacon sync <course>`.
3. Re-run `beacon status <course>`.

## Selecting items

1. Collect all `LEARNED` and `LEARNED_PARTIAL` items from the `progress` section.
2. Sort by date ascending — oldest first (most at risk of being forgotten).
3. For `LEARNED_PARTIAL` items, focus questions on the `NOT_LEARNED` subpointers.

## Running the session

- One question at a time, conversational, not multiple choice.
- Evaluate using the same classification rules in SKILL.md.
- After each answer, explain what was right/wrong.
- Continue until the user says stop or all items are covered.

## Updating KNOWLEDGE.md

After each question, immediately update KNOWLEDGE.md. Use `beacon progress <course>` to re-read state if needed. Always run `beacon sync <course>` before the first update.

Classification:
- **Correct and complete** → update LEARNED date to today.
- **Directionally correct but missing mechanism** → downgrade to `LEARNED_PARTIAL` with subpointers. Add misunderstandings/unknowns to their sections.
- **Wrong** → downgrade to `LEARNED_PARTIAL` with a `MISUNDERSTANDING` subpointer. Add to Misunderstandings section.
