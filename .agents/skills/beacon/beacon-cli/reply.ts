import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { object } from "@optique/core/constructs";
import { optional } from "@optique/core/modifiers";
import { argument, option } from "@optique/core/primitives";
import { string, choice, json } from "@optique/core/valueparser";
import { conditional } from "@optique/core";
import { message } from "@optique/core/message";
import { defineCommand } from "@optique/discover";

const repoRoot = (() => {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  } catch {
    return process.cwd();
  }
})();

const SERVER_INFO_PATH = path.join(repoRoot, ".beacon", "server.json");

function die(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

// ── sessions reply command ───────────────────────────────────────────────────

const REPLY_TYPES = [
  "message:ack",
  "chat",
  "lesson:answer:clarify",
  "lesson:answer:success",
  "lesson:update-pointer",
  "lesson:observation",
  "lesson:suggestion:success",
  "lesson:generate:success",
  "lesson:committed",
  "agent:error",
  "placement:question",
  "placement:done",
  "placement:correction",
  "placement:committed",
] as const;

const mid = optional(option("--message-id", string()));

export const sessionsReplyCommand = defineCommand({
  path: ["sessions", "reply"],
  parser: object({
    sessionId: argument(string({ metavar: "SESSION" })),
    payload: conditional(option("--type", choice(REPLY_TYPES)), {
      "message:ack": object({
        replyTo: option("--reply-to", string()),
        messageId: mid,
      }),
      chat: object({
        replyTo: option("--reply-to", string()),
        messageId: mid,
        text: optional(option("--text", string())),
        content: optional(option("--content", string())),
      }),
      "agent:error": object({
        replyTo: option("--reply-to", string()),
        messageId: mid,
        text: optional(option("--text", string())),
        content: optional(option("--content", string())),
      }),
      "lesson:answer:clarify": object({
        course: option("--course", string()),
        lessonId: option("--lesson-id", string()),
        questionId: option("--question-id", string()),
        feedback: option("--feedback", string()),
        replyTo: option("--reply-to", string()),
        messageId: mid,
      }),
      "lesson:answer:success": object({
        course: option("--course", string()),
        lessonId: option("--lesson-id", string()),
        questionId: option("--question-id", string()),
        questionTitle: option("--question-title", string()),
        answer: option("--answer", string()),
        result: option(
          "--result",
          choice(["CORRECT", "PARTIALLY_CORRECT", "INCORRECT"] as const),
        ),
        feedback: option("--feedback", string()),
        replyTo: option("--reply-to", string()),
        messageId: mid,
      }),
      "lesson:update-pointer": object({
        course: option("--course", string()),
        lessonId: option("--lesson-id", string()),
        questionId: option("--question-id", string()),
        result: option(
          "--result",
          choice(["LEARNED", "LEARNED_PARTIAL", "NOT_LEARNED"] as const),
        ),
        itemText: option("--item-text", string()),
        feedback: option("--feedback", string()),
        replyTo: option("--reply-to", string()),
        messageId: mid,
      }),
      "lesson:observation": object({
        course: option("--course", string()),
        lessonId: option("--lesson-id", string()),
        text: option("--text", string()),
        category: optional(
          option(
            "--category",
            choice(["bonus", "misunderstanding", "unknown"] as const),
          ),
        ),
        status: optional(
          option("--status", choice(["ACTIVE", "CLEARED"] as const)),
        ),
        messageId: mid,
      }),
      "lesson:suggestion:success": object({
        course: optional(option("--course", string())),
        courseId: optional(option("--course-id", string())),
        rationale: option("--rationale", string()),
        suggestions: option("--suggestions", json()),
        chips: optional(option("--chips", json())),
        messageId: mid,
      }),
      "lesson:generate:success": object({
        title: option("--title", string()),
        course: option("--course", string()),
        lessonId: option("--lesson-id", string()),
        messageId: mid,
      }),
      "lesson:committed": object({
        course: option("--course", string()),
        lessonId: option("--lesson-id", string()),
        summary: option("--summary", json()),
        messageId: mid,
      }),
      "placement:question": object({
        question: option("--question", json()),
        messageId: mid,
      }),
      "placement:done": object({
        proposed: option("--proposed", json()),
        messageId: mid,
      }),
      "placement:correction": object({
        proposed: option("--proposed", json()),
        messageId: mid,
      }),
      "placement:committed": object({ messageId: mid }),
    } as const),
  }),
  metadata: { brief: message`Push an event to a viewer session.` },
  async handler({ sessionId, payload }) {
    const [type, fields] = payload;
    const opts: Record<string, unknown> = { type, ...fields };
    if (opts.content && !opts.text) opts.text = opts.content;
    const jsonStr = JSON.stringify(opts);

    let info: { port: number };
    try {
      info = JSON.parse(fs.readFileSync(SERVER_INFO_PATH, "utf8")) as {
        port: number;
      };
    } catch {
      die(`server not running — run "beacon serve" first`);
    }

    try {
      const res = await fetch(
        `http://localhost:${info.port}/sessions/${sessionId}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: jsonStr,
        },
      );
      const data = await res.text();
      try {
        const r = JSON.parse(data) as { ok: boolean; pushed: number };
        if (r.ok) console.log(`pushed to ${r.pushed} client(s)`);
        else die(`server error: ${data}`);
      } catch {
        die(`server error: ${data}`);
      }
    } catch (e: unknown) {
      die(`failed to reach server: ${(e as Error).message}`);
    }
  },
});
