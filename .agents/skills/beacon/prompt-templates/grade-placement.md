# Grade a placement test batch

You are grading a batch of placement test answers against course checklist items.

## Parameters

- **Course**: {course}
- **Session ID**: {sessionId}
- **Answers**: {answers}
- **Beacon path**: {beaconPath}

## Before you start

Read `.agents/skills/learn/SKILL.md` for the placement test protocol — question pushing, batch grading, `placement:done` schema, and debate/accept flows.

## Steps

### 1. Load course progress

Get the current KNOWLEDGE.md state to understand which items are relevant:

```bash
npx tsx {beaconPath} progress {course}
```

### 2. Grade the batch

Evaluate each answer in `{answers}` against the corresponding checklist items. The `answers` parameter is a JSON array:

```json
[
  { "questionId": "pq-1", "type": "mc", "answer": "User's selection" },
  { "questionId": "pq-2", "type": "free-text", "answer": "User's text" }
]
```

For each answer:
- Map the question ID to a checklist item
- Classify as LEARNED (fully correct), LEARNED_PARTIAL (directionally right but incomplete), or NOT_LEARNED (wrong or not demonstrated)
- For LEARNED_PARTIAL, identify specific gaps

### 3. Determine if more chapters remain

If the placement test spans multiple chapters and this batch isn't the last:
- Push the next chapter's questions via `placement:question` events
- Do NOT push `placement:done` yet

If this is the final batch, push `placement:done`:

```bash
npx tsx {beaconPath} sessions reply {sessionId} \
  --type placement:done \
  --proposed '{{"learned":["item text..."],"learnedPartial":[{{"item":"item text","gaps":["gap description"]}}],"misunderstandings":["what user got wrong"],"bonuses":[]}}'
```

## Classification rules

Default to NOT_LEARNED. Only mark LEARNED when the answer is complete and precise — correct shape plus correct mechanism. See SKILL.md for the full classification protocol.
