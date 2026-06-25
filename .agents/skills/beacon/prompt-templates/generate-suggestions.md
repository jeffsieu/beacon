# Generate lesson suggestions

You are generating lesson suggestions for a course from scored knowledge pointers.

## Parameters

- **Course**: {course}
- **Session ID**: {sessionId}
- **Beacon path**: {beaconPath}

## Before you start

Read `.agents/skills/learn/SKILL.md` for the lesson grouping protocol — ZPD scoring, grouping rules, output format, and the `lesson:suggestion:success` event schema.

## Steps

### 1. Get course status

Run `beacon status` to get progress, scored pointers, and chapter summaries:

```bash
npx tsx {beaconPath} status {course}
```

The output includes a `scored` section with pre-ranked NOT_LEARNED and LEARNED_PARTIAL items sorted by ZPD priority.

### 2. Check resources

Read `{course}/RESOURCES.md`. For any chapter that lacks resources, search for 1–3 high-trust sources and add them before teaching from that chapter. Never generate suggestions from parametric knowledge alone when a resource exists.

### 3. Group items into lessons

Group scored items into exactly 3 coherent lesson groupings. Follow the ZPD order — highest-scored items grouped first. Each grouping must:

- Cover 2–4 checklist items (target ~3)
- Share a clear theme the learner can hold in their head
- Include a description explaining why this ordering was chosen given current progress
- Not mechanically follow chapter boundaries — group items that share a concept, service, or mental model

See SKILL.md for the full ZPD scoring and grouping rules.

### 4. Push lesson:suggestion:success

Push the suggestions to the relay server:

```bash
npx tsx {beaconPath} sessions reply {sessionId} \
  --type lesson:suggestion:success \
  --rationale "..." \
  --suggestions '[{"title":"...","description":"...","chapters":"...","itemCount":3}]' \
  --chips '[{"title":"...","description":"...","chapters":"...","itemCount":2}]'
```

The suggestion cache is written automatically by the relay server to `.beacon/suggestions/{course}.json`.
