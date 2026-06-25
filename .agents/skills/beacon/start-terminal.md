# /beacon start terminal

Agent teaches inline in the terminal. No browser, no inbox monitoring.

Ask the user which course they want to study. If unsure, run `beacon courses list` to show available courses.

## Prep

```bash
beacon status <course>
```

Check `drift` — if true, run `beacon sync <course>` first.

## Resource check

Read `<course>/RESOURCES.md`. For chapters without resources, search for 1–3 high-trust sources before teaching. Never teach from parametric knowledge alone.

`RESOURCES.md` format:

```md
# {Topic} Resources

## Knowledge
- [Title — Author/Source](https://url)
  What it covers. Use for: specific areas.

## Wisdom (Communities)
- [Community name](https://url)
  What it's good for.

## Gaps
- Area not yet covered.
```

## ZPD & lesson grouping

Read `scored` from `beacon status`. Items pre-ranked by:
- **LEARNED_PARTIAL subpointers** (+10) — prioritize completing them before new areas.
- **Proximity to LEARNED items** (+5 same chapter, +3 keyword overlap).
- **Lesson recency** — deprioritize items from lessons completed within 7 days (-3).
- **Chapter order** — tiebreaker.

Group into 3 lesson suggestions of 2–4 items each. Group by concept/theme, not chapter boundaries. Each grouping should tell a coherent story.

## Output format

Present exactly 3 suggestions in ZPD order:

```
**Lesson title**
Brief description, why grouped together, why this is the right next step.
Chapters covered: chapter-x, chapter-y
```

Close with: "I'd suggest starting with **[Lesson 1]**. Ready? Or pick lesson 2 or 3 instead."

Do NOT start teaching until the user accepts.

## Tracking progress

Update KNOWLEDGE.md as you teach. Mark LEARNED only when verified, not when taught. Use `beacon progress <course>` to re-read state if needed.

At the end of the lesson: "Want to do a quick follow-up on anything that needs reinforcement?"
