// Route definitions for the Beacon relay server.
// Exports mountRoutes(app, ctx) where ctx provides:
//   { push, sseClients, sessionExists, writeLessonProgress }

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as lib from "./lib.js";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const STATE_DIR = path.join(lib.repoRoot(), ".beacon");
const INBOX_PATH = path.join(STATE_DIR, "inbox.jsonl");
const SERVER_INFO_PATH = path.join(STATE_DIR, "server.json");

function tryParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// ── MDX lesson helpers ─────────────────────────────────────────────────────────

import { load } from "js-yaml";

interface MdxLesson {
  title: string;
  course: string;
  lessonId: string;
  body: string;
  knowledgeCheck: { id: string; title: string; type?: string }[];
  sources: { title: string; url: string }[];
}

function parseMdxLesson(raw: string, slug: string): MdxLesson {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  const meta = fmMatch
    ? (load(fmMatch[1]) as Record<string, unknown>) || {}
    : {};
  const body = fmMatch ? fmMatch[2].trimEnd() : raw.trimEnd();
  return {
    title: (meta.title as string) || slug,
    course: (meta.course as string) || "",
    lessonId: (meta.lessonId as string) || slug,
    body,
    knowledgeCheck: Array.isArray(meta.knowledgeCheck)
      ? (meta.knowledgeCheck as { id: string; title: string; type?: string }[])
      : [],
    sources: Array.isArray(meta.sources)
      ? (meta.sources as { title: string; url: string }[])
      : [],
  };
}

function findLessonMdx(
  lessonsDir: string,
  slug: string,
): { path: string; format: string } | null {
  const mdxPath = path.join(lessonsDir, slug, "LESSON.mdx");
  if (fs.existsSync(mdxPath)) return { path: mdxPath, format: "folder" };
  return null;
}

function computeLessonChecksum(
  lessonsDir: string,
  slug: string,
): string | null {
  const found = findLessonMdx(lessonsDir, slug);
  if (!found) return null;
  const raw = fs.readFileSync(found.path, "utf8");
  const lesson = parseMdxLesson(raw, slug);
  const input = lesson.knowledgeCheck
    .map((q) => `${q.id}|${q.title}|${q.type || "free-text"}`)
    .sort()
    .join("\n");
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

interface LessonProgress {
  questions: Record<string, unknown>;
  status: string;
  checksum?: string;
  stale?: boolean;
  currentChecksum?: string;
}

function readLessonProgress(lessonsDir: string, slug: string): LessonProgress {
  const progressPath = path.join(lessonsDir, slug, "lesson-progress.json");
  const currentChecksum = computeLessonChecksum(lessonsDir, slug);
  if (fs.existsSync(progressPath)) {
    const progress: LessonProgress = tryParse(
      fs.readFileSync(progressPath, "utf8"),
      { questions: {}, status: "pending" },
    );
    if (
      currentChecksum &&
      progress.checksum &&
      progress.checksum !== currentChecksum
    ) {
      progress.stale = true;
      progress.currentChecksum = currentChecksum;
    } else {
      progress.checksum = currentChecksum || undefined;
    }
    return progress;
  }
  return {
    questions: {},
    status: "pending",
    checksum: currentChecksum || undefined,
  };
}

function decodeCourse(id: string): string {
  return id.replace(/~/g, "/");
}

interface MountCtx {
  push: (sessionId: string, payload: Record<string, unknown>) => number;
  sseClients: Map<string, Set<{ write: (data: string) => void }>>;
  sessionExists: (sessionId: string) => boolean;
  writeLessonProgress: (
    course: string,
    lessonId: string,
    updateFn: (p: any) => void,
  ) => void;
}

function mountRoutes(
  app: Hono,
  { push, sseClients, sessionExists, writeLessonProgress }: MountCtx,
) {
  const repoRoot = lib.repoRoot();

  app.get("/health", (c) => c.json({ ok: true }));

  // ── sessions ──────────────────────────────────────────────────────────────

  app.get("/sessions", (c) => {
    const dir = path.join(STATE_DIR, "sessions");
    if (!fs.existsSync(dir)) return c.json({ sessions: [] });
    const results = [];
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const metaPath = path.join(dir, d.name, "meta.json");
      if (!fs.existsSync(metaPath)) continue;
      const meta = tryParse(
        fs.readFileSync(metaPath, "utf8"),
        {} as Record<string, unknown>,
      );
      const chatPath = path.join(dir, d.name, "chat.jsonl");
      if (!fs.existsSync(chatPath)) continue;
      const lines = fs
        .readFileSync(chatPath, "utf8")
        .split("\n")
        .filter(Boolean);
      let lastMessage = null;
      if (lines.length > 0) {
        try {
          lastMessage = JSON.parse(lines[lines.length - 1]);
        } catch {}
      }
      results.push({
        id: d.name,
        course: (meta.courseId as string | undefined) || null,
        title: (meta.title as string | undefined) || null,
        createdAt: (meta.createdAt as string | undefined) || null,
        messageCount: lines.length,
        lastMessage,
      });
    }
    results.sort((a: any, b: any) =>
      ((b.createdAt as string) || "").localeCompare(
        (a.createdAt as string) || "",
      ),
    );
    return c.json({ sessions: results });
  });

  app.get("/sessions/latest", (c) => {
    const dir = path.join(STATE_DIR, "sessions");
    if (!fs.existsSync(dir)) return c.json({ error: "no sessions" }, 404);
    const dirs = fs
      .readdirSync(dir)
      .filter((d: string) => fs.existsSync(path.join(dir, d, "meta.json")));
    if (!dirs.length) return c.json({ error: "no sessions" }, 404);
    const metas = dirs
      .map((d) =>
        tryParse(fs.readFileSync(path.join(dir, d, "meta.json"), "utf8"), null),
      )
      .filter(Boolean);
    metas.sort((a: any, b: any) =>
      ((b.createdAt as string) || "").localeCompare(
        (a.createdAt as string) || "",
      ),
    );
    return c.json(metas[0]);
  });

  app.post("/sessions", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const sessionId = body.sessionId || crypto.randomUUID();
    const sessionDir = path.join(STATE_DIR, "sessions", sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    if (!fs.existsSync(INBOX_PATH)) fs.writeFileSync(INBOX_PATH, "");
    const meta = {
      sessionId,
      courseId: body.courseId || null,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(sessionDir, "meta.json"),
      JSON.stringify(meta, null, 2),
    );
    console.log(
      `[session] created ${sessionId} (${body.courseId || "no course"})`,
    );
    return c.json({ sessionId });
  });

  app.patch("/sessions/:id", async (c) => {
    const sessionId = c.req.param("id");
    if (!sessionExists(sessionId))
      return c.json({ error: "session not found" }, 404);
    const { title } = await c.req
      .json()
      .catch(() => ({}) as Record<string, unknown>);
    if (!title) return c.json({ error: "title required" }, 400);
    const metaPath = path.join(STATE_DIR, "sessions", sessionId, "meta.json");
    const meta = tryParse(
      fs.readFileSync(metaPath, "utf8"),
      {} as Record<string, unknown>,
    );
    meta.title = title;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
    return c.json({ ok: true });
  });

  // ── SSE ────────────────────────────────────────────────────────────────────

  app.get("/sessions/:id/events", (c) => {
    const sessionId = c.req.param("id");
    if (!sessionExists(sessionId))
      return c.json({ error: "session not found" }, 404);
    return streamSSE(c, async (stream) => {
      stream.writeSSE({
        data: JSON.stringify({ type: "connected", sessionId }),
      });
      if (!sseClients!.has(sessionId)) sseClients!.set(sessionId, new Set());
      sseClients!.get(sessionId)!.add(stream);
      console.log(
        `[sse] client connected to ${sessionId} (total: ${sseClients!.get(sessionId)!.size})`,
      );
      stream.onAbort(() => {
        sseClients!.get(sessionId)?.delete(stream);
        console.log(`[sse] client disconnected from ${sessionId}`);
      });
      while (true) {
        await stream.sleep(30000);
        stream.writeSSE({ data: ":keepalive" });
      }
    });
  });

  // ── messages ───────────────────────────────────────────────────────────────

  app.get("/sessions/:id/messages", (c) => {
    const sessionId = c.req.param("id");
    if (!sessionExists(sessionId))
      return c.json({ error: "session not found" }, 404);
    const chatPath = path.join(STATE_DIR, "sessions", sessionId, "chat.jsonl");
    if (!fs.existsSync(chatPath)) return c.json({ messages: [] });
    const messages = fs
      .readFileSync(chatPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return c.json({ messages });
  });

  // ── message (UI → inbox) ────────────────────────────────────────────────────

  app.post("/sessions/:id/message", async (c) => {
    const sessionId = c.req.param("id");
    if (!sessionExists(sessionId))
      return c.json({ error: "session not found" }, 404);
    const msg = await c.req.json().catch(() => ({}));
    const line =
      JSON.stringify({
        ...msg,
        sessionId,
        receivedAt: new Date().toISOString(),
      }) + "\n";
    fs.appendFileSync(INBOX_PATH, line);

    const chatPath = path.join(STATE_DIR, "sessions", sessionId, "chat.jsonl");
    const append = (entry: Record<string, unknown>) =>
      fs.appendFileSync(
        chatPath,
        JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) +
          "\n",
      );

    if (msg.type === "chat") {
      append({
        role: "user",
        type: "chat",
        text: msg.content,
        contextText: msg.context?.selectedText || null,
        id: msg.messageId || null,
      });
    }
    if (msg.type === "lesson:generate") {
      append({
        role: "user",
        type: "lesson:generate",
        courseId: msg.courseId || null,
        suggestionIndex: msg.suggestionIndex,
        mode: msg.mode || "browser",
        title: msg.title || null,
        id: msg.messageId || null,
      });
    }
    if (msg.type === "lesson:answer") {
      append({
        role: "user",
        type: "lesson:answer",
        questionId: msg.questionId,
        questionTitle: msg.questionTitle,
        answer: msg.answer,
        id: msg.messageId || null,
      });
    }
    if (msg.type === "lesson:answer-mc") {
      append({
        role: "user",
        type: "lesson:answer-mc",
        questionId: msg.questionId,
        answer: msg.answer,
        correct: msg.correct,
      });
      push(sessionId, {
        type: "lesson:answer-mc",
        questionId: msg.questionId,
        answer: msg.answer,
        correct: msg.correct,
      });
    }
    console.log(`[message] session=${sessionId} type=${msg.type || "unknown"}`);
    return c.json({ ok: true });
  });

  // ── reply (agent → SSE) ────────────────────────────────────────────────────

  app.post("/sessions/:id/reply", async (c) => {
    const sessionId = c.req.param("id");
    if (!sessionExists(sessionId))
      return c.json({ error: "session not found" }, 404);
    const payload = await c.req.json().catch(() => ({}));
    if (!payload.messageId) payload.messageId = crypto.randomUUID();

    const pushed = push(sessionId, payload);

    const chatPath = path.join(STATE_DIR, "sessions", sessionId, "chat.jsonl");
    const appendChat = (entry: Record<string, unknown>) =>
      fs.appendFileSync(
        chatPath,
        JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) +
          "\n",
      );

    const writeProgress = (updateFn: (p: any) => void) => {
      if (payload.course && payload.lessonId)
        writeLessonProgress(payload.course, payload.lessonId, updateFn);
    };

    if (payload.type === "chat" || payload.type === "agent:error") {
      appendChat({
        role: "assistant",
        type: payload.type,
        text: payload.content || payload.text,
        replyTo: payload.replyTo || null,
        messageId: payload.messageId,
      });
    }

    if (payload.type === "lesson:answer:clarify") {
      appendChat({
        role: "assistant",
        type: "lesson:answer:clarify",
        questionId: payload.questionId,
        feedback: payload.feedback || "",
        replyTo: payload.replyTo || null,
        messageId: payload.messageId,
      });
      writeProgress((p: any) => {
        p.questions = p.questions || {};
        p.questions[payload.questionId] = p.questions[payload.questionId] || {};
        p.questions[payload.questionId].clarification = payload.feedback || "";
      });
    }

    if (payload.type === "lesson:answer:success") {
      appendChat({
        role: "assistant",
        type: "lesson:answer:success",
        questionId: payload.questionId,
        questionTitle: payload.questionTitle || "",
        answer: payload.answer || "",
        result: payload.result,
        feedback: payload.feedback || "",
        messageId: payload.messageId,
      });
      writeProgress((p: any) => {
        p.questions = p.questions || {};
        p.questions[payload.questionId] = p.questions[payload.questionId] || {};
        p.questions[payload.questionId].grade = payload.result;
        p.questions[payload.questionId].feedback = payload.feedback || "";
        p.questions[payload.questionId].answer = payload.answer || "";
      });
    }

    if (payload.type === "lesson:update-pointer") {
      appendChat({
        role: "assistant",
        type: "lesson:update-pointer",
        questionId: payload.questionId,
        result: payload.result,
        itemText: payload.itemText,
        feedback: payload.feedback,
        replyTo: payload.replyTo || null,
        messageId: payload.messageId,
      });
      writeProgress((p: any) => {
        p.questions = p.questions || {};
        p.questions[payload.questionId] = p.questions[payload.questionId] || {};
        if (!p.questions[payload.questionId].pointer)
          p.questions[payload.questionId].pointer = {};
        p.questions[payload.questionId].pointer.status = payload.result;
        p.questions[payload.questionId].pointer.feedback =
          payload.feedback || "";
        p.questions[payload.questionId].questionText = payload.itemText || "";
      });
    }

    if (payload.type === "lesson:observation") {
      appendChat({
        role: "assistant",
        type: "lesson:observation",
        category: payload.category || "bonus",
        text: payload.text,
        status: payload.status || null,
        messageId: payload.messageId,
      });
      writeProgress((p: any) => {
        if (!p.observations) p.observations = [];
        p.observations.push({
          category: payload.category || "bonus",
          text: payload.text,
          status: payload.status || null,
          timestamp: new Date().toISOString(),
        });
      });
    }

    if (payload.type === "lesson:committed") {
      writeProgress((p: any) => {
        p.status = "completed";
      });
      appendChat({
        role: "assistant",
        type: "lesson:committed",
        summary: payload.summary || [],
        messageId: payload.messageId,
      });
    }

    if (payload.type === "message:ack") {
      appendChat({
        role: "assistant",
        type: "message:ack",
        replyTo: payload.replyTo || null,
        messageId: payload.messageId,
      });
    }

    if (payload.type === "lesson:generate:success") {
      appendChat({
        role: "assistant",
        type: "lesson:generate:success",
        lessonId: payload.lessonId || null,
        title: payload.title || null,
        course: payload.course || null,
        messageId: payload.messageId,
      });
    }

    if (payload.type === "lesson:suggestion:success") {
      appendChat({
        role: "assistant",
        type: "lesson:suggestion:success",
        suggestions: payload.suggestions || [],
        chips: payload.chips || [],
        rationale: payload.rationale || "",
        messageId: payload.messageId,
      });
      const courseId = payload.course || payload.courseId;
      const suggDir = path.join(STATE_DIR, "suggestions");
      fs.mkdirSync(suggDir, { recursive: true });
      if (courseId) {
        if (Array.isArray(payload.suggestions)) {
          for (const sug of payload.suggestions) {
            const sugCourseId = sug.courseId || courseId;
            const kPath = path.join(
              repoRoot,
              "progress",
              sugCourseId,
              "KNOWLEDGE.md",
            );
            if (!fs.existsSync(kPath)) continue;
            const { progress: kProgress } = lib.parseKnowledge(
              fs.readFileSync(kPath, "utf8"),
            );
            const statusMap = new Map();
            for (const items of Object.values(kProgress) as any[]) {
              for (const item of items) {
                statusMap.set(
                  item.text.replace(/\s+/g, " ").trim().toLowerCase(),
                  item.status,
                );
              }
            }
            if (Array.isArray(sug.items) && sug.items.length > 0) {
              for (const item of sug.items) {
                const key = (item.text || "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .toLowerCase();
                item.status = statusMap.get(key) || "NOT_LEARNED";
              }
            } else {
              const chapterFilter = sug.chapters
                ? typeof sug.chapters === "string"
                  ? sug.chapters.split(/,\s*/)
                  : sug.chapters
                : Object.keys(kProgress);
              sug.items = [];
              for (const [chapter, items] of Object.entries(
                kProgress,
              ) as any[]) {
                if (!chapterFilter.includes(chapter)) continue;
                for (const item of items) {
                  if (item.status !== "LEARNED")
                    sug.items.push({
                      text: item.text,
                      chapter,
                      status: item.status,
                    });
                }
              }
            }
          }
        }
        fs.writeFileSync(
          path.join(suggDir, courseId + ".json"),
          JSON.stringify(payload),
        );
      } else {
        fs.writeFileSync(
          path.join(suggDir, "dashboard.json"),
          JSON.stringify(payload),
        );
      }
    }

    console.log(`[reply] session=${sessionId} pushed to ${pushed} client(s)`);
    return c.json({ ok: true, pushed });
  });

  // ── reading state ──────────────────────────────────────────────────────────

  app.post("/sessions/:id/state", async (c) => {
    const sessionId = c.req.param("id");
    if (!sessionExists(sessionId))
      return c.json({ error: "session not found" }, 404);
    const state = await c.req.json().catch(() => ({}));
    fs.writeFileSync(
      path.join(STATE_DIR, "sessions", sessionId, "state.json"),
      JSON.stringify(
        { ...state, updatedAt: new Date().toISOString() },
        null,
        2,
      ),
    );
    return c.json({ ok: true });
  });

  app.get("/sessions/:id/state", (c) => {
    const sessionId = c.req.param("id");
    if (!sessionExists(sessionId))
      return c.json({ error: "session not found" }, 404);
    const statePath = path.join(STATE_DIR, "sessions", sessionId, "state.json");
    if (!fs.existsSync(statePath)) return c.json({ state: null });
    return c.json(tryParse(fs.readFileSync(statePath, "utf8"), null));
  });

  // ── lessons ────────────────────────────────────────────────────────────────

  app.get("/lessons", (c) => {
    const manifest = [];
    const courses = lib.discoverCourses();
    for (const crs of courses) {
      if (!crs.id) continue;
      const lessonsDir = path.join(repoRoot, ".beacon", "lessons", crs.id);
      if (!fs.existsSync(lessonsDir)) continue;
      const seen = new Set();
      for (const item of fs.readdirSync(lessonsDir, { withFileTypes: true })) {
        if (!item.isDirectory()) continue;
        const mdxPath = path.join(lessonsDir, item.name, "LESSON.mdx");
        if (!fs.existsSync(mdxPath)) continue;
        seen.add(item.name);
        let title = item.name;
        try {
          const raw = fs.readFileSync(mdxPath, "utf8");
          const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
          if (fmMatch) {
            const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m);
            if (titleMatch) title = titleMatch[1].trim();
          } else {
            const m = raw.match(/^#\s+(.+)/m);
            if (m) title = m[1].trim();
          }
        } catch {}
        const progress = readLessonProgress(lessonsDir, item.name);
        manifest.push({
          course: crs.id,
          slug: item.name,
          title,
          status: progress.status,
        });
      }
    }
    manifest.sort((a, b) => b.slug.localeCompare(a.slug));
    return c.json(manifest);
  });

  app.get("/lessons/:course/:slug", (c) => {
    const course = decodeCourse(c.req.param("course"));
    const slug = c.req.param("slug");
    const lessonsDir = path.join(repoRoot, ".beacon", "lessons", course);
    const found = findLessonMdx(lessonsDir, slug);
    if (found) {
      const raw = fs.readFileSync(found.path, "utf8");
      const lesson = parseMdxLesson(raw, slug);
      const progress = readLessonProgress(lessonsDir, slug);
      return c.json({ ...lesson, course, status: progress.status });
    }
    return c.json({ error: "lesson not found" }, 404);
  });

  app.get("/lessons/:course/:slug/progress", (c) => {
    const course = decodeCourse(c.req.param("course"));
    const slug = c.req.param("slug");
    const lessonsDir = path.join(repoRoot, ".beacon", "lessons", course);
    return c.json(readLessonProgress(lessonsDir, slug));
  });

  // ── courses ────────────────────────────────────────────────────────────────

  app.get("/courses", (c) => {
    const courses = lib.discoverCourses();
    const result = [];
    for (const crs of courses) {
      if (!crs.id) continue;
      let total = 0,
        learned = 0,
        partial = 0,
        notLearned = 0;
      const kPath = path.join(repoRoot, "progress", crs.id, "KNOWLEDGE.md");
      if (fs.existsSync(kPath)) {
        const { progress: kProgress } = lib.parseKnowledge(
          fs.readFileSync(kPath, "utf8"),
        );
        for (const items of Object.values(kProgress) as any[]) {
          for (const item of items) {
            total++;
            if (item.status === "LEARNED") learned++;
            else if (item.status === "LEARNED_PARTIAL") partial++;
            else notLearned++;
          }
        }
      }
      result.push({
        course: crs.id,
        title: crs.title,
        description: crs.description,
        totalItems: total,
        learnedCount: learned,
        partialCount: partial,
        notLearnedCount: notLearned,
      });
    }
    return c.json(result);
  });

  app.get("/courses/:course/progress", (c) => {
    const course = decodeCourse(c.req.param("course"));
    const kPath = path.join(repoRoot, "progress", course, "KNOWLEDGE.md");
    if (!fs.existsSync(kPath))
      return c.json({ error: "course not found" }, 404);
    const {
      progress: kProgress,
      misunderstandings,
      bonuses,
    } = lib.parseKnowledge(fs.readFileSync(kPath, "utf8"));
    const courseDir = lib.courseDirById(course);
    if (!courseDir) return c.json({ error: "course not found" }, 404);
    const chapterTitles = lib.parseChapters(courseDir);
    const chapters = Object.entries(kProgress).map(([slug, items]) => ({
      chapter: slug,
      title: chapterTitles[slug]?.title || slug,
      summary: chapterTitles[slug]?.summary || "",
      items,
    }));
    let total = 0,
      learned = 0,
      partial = 0,
      notLearned = 0;
    for (const items of Object.values(kProgress) as any[]) {
      for (const item of items) {
        total++;
        if (item.status === "LEARNED") learned++;
        else if (item.status === "LEARNED_PARTIAL") partial++;
        else notLearned++;
      }
    }
    return c.json({
      course,
      chapters,
      misunderstandings: misunderstandings.map((m) => m.text),
      bonuses: bonuses.map((b) => b.text),
      stats: { total, learned, partial, notLearned },
    });
  });

  app.get("/courses/:course/suggestions", (c) => {
    const course = decodeCourse(c.req.param("course"));
    const suggPath = path.join(STATE_DIR, "suggestions", course + ".json");
    if (!fs.existsSync(suggPath))
      return c.json({ suggestions: [], chips: [], rationale: "" });
    const data = JSON.parse(fs.readFileSync(suggPath, "utf8"));
    return c.json({
      suggestions: data.suggestions || [],
      chips: data.chips || [],
      rationale: data.rationale || "",
    });
  });

  app.get("/dashboard/suggestions", (c) => {
    const suggPath = path.join(STATE_DIR, "suggestions", "dashboard.json");
    if (!fs.existsSync(suggPath))
      return c.json({ suggestions: [], chips: [], rationale: "" });
    const data = JSON.parse(fs.readFileSync(suggPath, "utf8"));
    return c.json({
      suggestions: data.suggestions || [],
      chips: data.chips || [],
      rationale: data.rationale || "",
    });
  });
}

export { mountRoutes };
