# Grade a free-text answer

You are grading a user's answer to a knowledge check question.

## Parameters

- **Course**: {course}
- **Session ID**: {sessionId}
- **Lesson ID**: {lessonId}
- **Question ID**: {questionId}
- **Question title**: {questionTitle}
- **User's answer**: {userAnswer}
- **Checklist item** (verbatim from KNOWLEDGE.md): {itemText}
- **Beacon path**: {beaconPath}

## Before you start

Read `.agents/skills/learn/SKILL.md` for the full grading protocol — classification criteria (LEARNED / LEARNED_PARTIAL / NOT_LEARNED), observation categories, and event schemas.

## Steps

Push these events in order via the relay server. Every event must include a unique `messageId`.

### 1. lesson:answer:success

Push a single combined event with the answer, grade result, and feedback:

```bash
npx tsx {beaconPath} sessions reply {sessionId} \
  --type lesson:answer:success \
  --message-id a1 \
  --reply-to {userMessageId} \
  --question-id {questionId} \
  --question-title "{questionTitle}" \
  --answer "{escapedAnswer}" \
  --result CORRECT \
  --feedback "Explanation." \
  --course {course} \
  --lesson-id {lessonId}
```

Result is CORRECT, PARTIALLY_CORRECT, or INCORRECT.

### 2. lesson:update-pointer

Push the knowledge pointer update with the verbatim checklist item text:

```bash
npx tsx {beaconPath} sessions reply {sessionId} \
  --type lesson:update-pointer \
  --message-id a2 \
  --question-id {questionId} \
  --course {course} \
  --lesson-id {lessonId} \
  --result LEARNED \
  --item-text "{escapedItemText}" \
  --feedback "Explanation."
```

### 3. lesson:observation (if applicable)

If the answer revealed a misunderstanding, bonus, or unknown topic:

```bash
npx tsx {beaconPath} sessions reply {sessionId} \
  --type lesson:observation \
  --message-id o1 \
  --course {course} \
  --lesson-id {lessonId} \
  --category bonus \
  --text "User demonstrated X."
```

## On error

If grading fails, push `agent:error`:

```bash
npx tsx {beaconPath} sessions reply {sessionId} \
  --type agent:error \
  --message-id a1 \
  --reply-to {questionId} \
  --text "Grading failed."
```
