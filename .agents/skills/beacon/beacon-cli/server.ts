import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { object } from "@optique/core/constructs";
import { optional, multiple } from "@optique/core/modifiers";
import { argument, option } from "@optique/core/primitives";
import { string, integer, port } from "@optique/core/valueparser";
import { message } from "@optique/core/message";
import { defineCommand } from "@optique/discover";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { load } from "js-yaml";
import { mountRoutes } from "./server-routes.js";
import * as lib from "./lib.js";
import { sessionsReplyCommand } from "./reply.js";

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

const STATE_DIR = path.join(repoRoot, ".beacon");
const INBOX_PATH = path.join(STATE_DIR, "inbox.jsonl");
const SERVER_INFO_PATH = path.join(STATE_DIR, "server.json");

function die(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}
function tryParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
function sessionExists(sessionId: string): boolean {
  return fs.existsSync(
    path.join(STATE_DIR, "sessions", sessionId, "meta.json"),
  );
}

// ── serve ─────────────────────────────────────────────────────────────────────

const serveCmd = defineCommand({
  path: ["serve"],
  parser: object({
    port: optional(option("--port", port())),
    corsOrigin: optional(option("--cors-origin", string())),
  }),
  metadata: { brief: message`Start the relay server.` },
  handler({ port, corsOrigin }) {
    const p = port ?? 4646;
    const origin = corsOrigin ?? "http://localhost:5173";
    fs.mkdirSync(path.join(STATE_DIR, "sessions"), { recursive: true });

    const sseClients = new Map<
      string,
      Set<{ write: (data: string) => void }>
    >();
    function push(sid: string, payload: Record<string, unknown>): number {
      const clients = sseClients.get(sid);
      if (!clients || clients.size === 0) return 0;
      const event = `data: ${JSON.stringify(payload)}\n\n`;
      for (const c of clients) c.write(event);
      return clients.size;
    }

    // writeLessonProgress is defined in server-routes, imported via mountRoutes ctx below
    // but we need a local copy for push. Let's keep it in server-routes.

    const app = new Hono();
    app.use("*", cors({ origin }));

    function writeLessonProgress(
      course: string,
      lessonId: string,
      updateFn: (p: any) => void,
    ) {
      const lessonsDir = path.join(repoRoot, ".beacon", "lessons", course);
      const lessonDir = path.join(lessonsDir, lessonId);
      fs.mkdirSync(lessonDir, { recursive: true });
      const progressPath = path.join(lessonDir, "lesson-progress.json");
      const progress: Record<string, any> = fs.existsSync(progressPath)
        ? tryParse(fs.readFileSync(progressPath, "utf8"), {
            questions: {},
            status: "pending",
          } as Record<string, any>)
        : { questions: {}, status: "pending" };
      updateFn(progress);
      const found = (() => {
        const mdxPath = path.join(lessonsDir, lessonId, "LESSON.mdx");
        if (!fs.existsSync(mdxPath)) return null;
        return { path: mdxPath };
      })();
      if (found) {
        const raw = fs.readFileSync(found.path, "utf8");
        const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (fmMatch) {
          const meta = (load(fmMatch[1]) || {}) as Record<string, unknown>;
          const kc = Array.isArray(meta.knowledgeCheck)
            ? (meta.knowledgeCheck as any[])
            : [];
          const input = kc
            .map((q: any) => `${q.id}|${q.title}|${q.type || "free-text"}`)
            .sort()
            .join("\n");
          progress.checksum = crypto
            .createHash("sha256")
            .update(input)
            .digest("hex")
            .slice(0, 16);
        }
      }
      fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
    }
    mountRoutes(app, { push, sseClients, sessionExists, writeLessonProgress });

    serve({ fetch: app.fetch, port: p }, (info) => {
      fs.writeFileSync(
        SERVER_INFO_PATH,
        JSON.stringify(
          {
            port: info.port,
            pid: process.pid,
            startedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      console.log(`beacon-server listening on http://localhost:${info.port}`);
      console.log(`inbox: ${INBOX_PATH}`);
    });

    process.on("SIGINT", () => {
      fs.rmSync(SERVER_INFO_PATH, { force: true });
      console.log("\nbeacon-server stopped");
      process.exit(0);
    });
  },
});

// ── sessions: state ───────────────────────────────────────────────────────────

const sessionsState = defineCommand({
  path: ["sessions", "state"],
  parser: object({ sessionId: argument(string({ metavar: "SESSION" })) }),
  metadata: { brief: message`Query viewer reading state.` },
  async handler({ sessionId }) {
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
        `http://localhost:${info.port}/sessions/${sessionId}/state`,
      );
      if (res.status === 404) die("session not found");
      const data = await res.text();
      const state = tryParse(data, null);
      if (!state) {
        console.log("No state recorded yet.");
        return;
      }
      console.log(lib.emitYaml(state));
    } catch (e: unknown) {
      die(`failed to reach server: ${(e as Error).message}`);
    }
  },
});

// ── sessions: messages ────────────────────────────────────────────────────────

const sessionsMessages = defineCommand({
  path: ["sessions", "messages"],
  parser: object({
    sessionId: argument(string({ metavar: "SESSION" })),
    limit: optional(option("--limit", integer({ min: 1 }))),
  }),
  metadata: { brief: message`Pull chat history.` },
  handler({ sessionId, limit }) {
    const chatPath = path.join(STATE_DIR, "sessions", sessionId, "chat.jsonl");
    if (!fs.existsSync(chatPath)) {
      console.log("No chat history for this session.");
      return;
    }
    const lines = fs.readFileSync(chatPath, "utf8").split("\n").filter(Boolean);
    const messages = lines
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Record<string, unknown>[];
    const subset = limit != null ? messages.slice(-limit) : messages;
    for (const msg of subset) {
      const ts = msg.timestamp
        ? new Date(msg.timestamp as string)
            .toISOString()
            .replace("T", " ")
            .slice(0, 19)
        : "unknown";
      const idPart = msg.id
        ? `(${msg.id}${msg.replyTo ? " ↢ " + msg.replyTo : ""}) `
        : "";
      const metaPart: string[] = [];
      if (msg.result) metaPart.push(msg.result as string);
      if (msg.questionId) metaPart.push(msg.questionId as string);
      if (msg.itemText) metaPart.push(`"${msg.itemText}"`);
      const meta = metaPart.length > 0 ? ` [${metaPart.join(" | ")}]` : "";
      const content =
        msg.type === "message:ack"
          ? `[ack → ${msg.replyTo || "?"}]`
          : msg.type === "lesson:answer:success"
            ? `[Answer graded: ${msg.questionId} → ${msg.result}]`
            : msg.role === "agent:error"
              ? `[Error: ${msg.text || "?"}${msg.replyTo ? " (re: " + msg.replyTo + ")" : ""}]`
              : msg.type === "lesson:generate:success"
                ? `[Lesson generated: ${msg.title || msg.lessonId || "?"}]`
                : msg.type === "lesson:suggestion:success"
                  ? `[Suggestions: ${((msg.suggestions as Array<{ title: string }>) || []).map((s) => s.title).join(", ")}]`
                  : msg.type === "lesson:generate"
                    ? `[Started lesson from suggestion #${msg.suggestionIndex}]`
                    : ((msg.content ||
                        msg.answer ||
                        msg.feedback ||
                        msg.text ||
                        JSON.stringify(msg)) as string);
      console.log(`${idPart}[${ts}] ${msg.role}${meta}: ${content}`);
    }
  },
});

// ── sessions: list ────────────────────────────────────────────────────────────

const sessionsList = defineCommand({
  path: ["sessions", "list"],
  parser: object({}),
  metadata: { brief: message`List all sessions.` },
  handler() {
    const dir = path.join(STATE_DIR, "sessions");
    if (!fs.existsSync(dir)) {
      console.log("No sessions.");
      return;
    }
    const dirs = fs
      .readdirSync(dir)
      .filter((d) => fs.existsSync(path.join(dir, d, "meta.json")));
    if (dirs.length === 0) {
      console.log("No sessions.");
      return;
    }
    const rows = dirs.map((id) => {
      const meta = tryParse(
        fs.readFileSync(path.join(dir, id, "meta.json"), "utf8"),
        {} as Record<string, unknown>,
      );
      const cp = path.join(dir, id, "chat.jsonl");
      return {
        id,
        course: meta.courseId || null,
        messages: fs.existsSync(cp)
          ? fs.readFileSync(cp, "utf8").split("\n").filter(Boolean).length
          : 0,
        created: meta.createdAt || null,
      };
    });
    console.log(lib.emitYaml(rows));
  },
});

// ── sessions: create ──────────────────────────────────────────────────────────

const sessionsCreate = defineCommand({
  path: ["sessions", "create"],
  parser: object({
    courseId: optional(argument(string({ metavar: "COURSE" }))),
  }),
  metadata: { brief: message`Create a new session.` },
  async handler({ courseId }) {
    let info: { port: number };
    try {
      info = JSON.parse(fs.readFileSync(SERVER_INFO_PATH, "utf8")) as {
        port: number;
      };
    } catch {
      die(`server not running — run "beacon serve" first`);
    }

    try {
      const res = await fetch(`http://localhost:${info.port}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: courseId || null }),
      });
      const data = await res.text();
      const r = tryParse(data, {}) as { sessionId?: string };
      if (!r.sessionId) die(`server error: ${data}`);
      console.log(`sessionId: ${r.sessionId}`);
      console.log(`url: http://localhost:5173?sessionId=${r.sessionId}`);
    } catch (e: unknown) {
      die(`failed to reach server: ${(e as Error).message}`);
    }
  },
});

// ── sessions: prune ───────────────────────────────────────────────────────────

const sessionsPrune = defineCommand({
  path: ["sessions", "prune"],
  parser: object({ dryRun: optional(option("--dry-run")) }),
  metadata: { brief: message`Remove sessions with no chat history.` },
  handler({ dryRun }) {
    const dir = path.join(STATE_DIR, "sessions");
    if (!fs.existsSync(dir)) {
      console.log("No sessions.");
      return;
    }
    const known = new Set(["meta.json", "chat.jsonl", "state.json"]);
    let cleaned = 0;
    for (const id of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!id.isDirectory()) continue;
      for (const f of fs.readdirSync(path.join(dir, id.name))) {
        if (!known.has(f)) {
          const fp = path.join(dir, id.name, f);
          if (dryRun) {
            console.log(`would remove unrecognised: ${id.name}/${f}`);
            cleaned++;
          } else {
            fs.unlinkSync(fp);
            cleaned++;
          }
        }
      }
    }
    if (cleaned > 0)
      console.log(
        `${dryRun ? "Would clean" : "Cleaned"} ${cleaned} unrecognised file(s).`,
      );
    const dirs = fs
      .readdirSync(dir)
      .filter((d) => fs.existsSync(path.join(dir, d, "meta.json")));
    let removed = 0;
    for (const id of dirs) {
      const cp = path.join(dir, id, "chat.jsonl");
      if (
        fs.existsSync(cp) &&
        fs.readFileSync(cp, "utf8").split("\n").filter(Boolean).length > 0
      )
        continue;
      if (dryRun) {
        console.log(`would prune: ${id}`);
        removed++;
      } else {
        fs.rmSync(path.join(dir, id), { recursive: true, force: true });
        removed++;
      }
    }
    console.log(
      `${dryRun ? "Would prune" : "Pruned"} ${removed} unused sessions.`,
    );
  },
});

// ── sessions: set-title ───────────────────────────────────────────────────────

const sessionsSetTitle = defineCommand({
  path: ["sessions", "set-title"],
  parser: object({
    sessionId: argument(string({ metavar: "SESSION" })),
    title: multiple(argument(string({ metavar: "TITLE" }))),
  }),
  metadata: { brief: message`Set session title.` },
  async handler({ sessionId, title }) {
    const t = title.join(" ");
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
        `http://localhost:${info.port}/sessions/${sessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t }),
        },
      );
      const data = await res.text();
      if (tryParse(data, { ok: false }).ok) console.log(`title set to: ${t}`);
      else die(`server error: ${data}`);
    } catch (e: unknown) {
      die(`failed to reach server: ${(e as Error).message}`);
    }
  },
});

export const serverCommands = [
  serveCmd,
  sessionsReplyCommand,
  sessionsState,
  sessionsMessages,
  sessionsList,
  sessionsCreate,
  sessionsPrune,
  sessionsSetTitle,
];


