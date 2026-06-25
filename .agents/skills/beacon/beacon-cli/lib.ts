
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { dump } from "js-yaml";

// ── repo root ──────────────────────────────────────────────────────────────────

let _repoRoot: string;
export function repoRoot() {
  if (_repoRoot) return _repoRoot;
  try {
    _repoRoot = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: "pipe",
    }).trim();
  } catch {
    _repoRoot = process.cwd();
  }
  return _repoRoot;
}

// ── error ──────────────────────────────────────────────────────────────────────

export function die(msg: string): never {
  process.stderr.write(`ERROR: ${msg}\n`);
  process.exit(2);
}

// ── date/time helpers ──────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── date/time helpers ──────────────────────────────────────────────────────────

export function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function nowDisplay(): string {
  const d = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── checksum ───────────────────────────────────────────────────────────────────

export function computeChecksum(courseDir: string): string {
  const out = execSync(
    `find . -mindepth 1 -not -path '*/.*' -type f | sort | xargs shasum -a 256 | shasum -a 256`,
    { cwd: courseDir, shell: true as any, encoding: "utf8" } as any,
  ).trim();
  return out.split(/\s+/)[0];
}

// ── KNOWLEDGE.md parser ────────────────────────────────────────────────────────
//
// Parses the full KNOWLEDGE.md into structured data.
// Returns: { checksum, progress: {}, misunderstandings: [], bonuses: [], unknown: [] }
//
// progress is { chapterSlug: [{ text, status, date?, subpointers: [{text, status, date}] }] }

export function parseKnowledge(content: string) {
  const checksumMatch = content.match(
    /^\[\/\/\]: # \(curriculum-checksum: ([^)]+)\)/m,
  );
  const checksum = checksumMatch ? checksumMatch[1] : null;

  const progress: Record<string, any[]> = {};
  const misunderstandings = [];
  const bonuses = [];
  const unknown = [];

  let section = null;
  let currentChapter: string | null = null;
  let currentItem: any = null;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    // Section headings
    if (trimmed === "## Main Progress") {
      section = "progress";
      currentChapter = null;
      currentItem = null;
      continue;
    }
    if (trimmed === "## Bonuses") {
      section = "bonuses";
      currentChapter = null;
      currentItem = null;
      continue;
    }
    if (trimmed === "## Misunderstandings") {
      section = "misunderstandings";
      currentChapter = null;
      currentItem = null;
      continue;
    }
    if (trimmed === "## Unknown") {
      section = "unknown";
      currentChapter = null;
      currentItem = null;
      continue;
    }
    if (/^## /.test(trimmed)) {
      section = null;
      continue;
    }

    if (section === "progress") {
      // Chapter slug line: "- chapter-slug:"
      const chapterMatch = line.match(/^- (chapter-[^:]+):$/);
      if (chapterMatch) {
        currentChapter = chapterMatch[1];
        progress[currentChapter] = [];
        currentItem = null;
        continue;
      }

      if (currentChapter && /^  - /.test(line)) {
        const itemText = line.slice(4);
        const learned = itemText.match(/^LEARNED \(([^)]+)\) - (.+)$/);
        const partial = itemText.match(/^LEARNED_PARTIAL \(([^)]+)\) - (.+)$/);
        const notLearned = itemText.match(/^NOT_LEARNED - (.+)$/);

        if (learned || partial || notLearned) {
          currentItem = {
            text:
              (learned || partial || notLearned)![2] ||
              (learned || partial || notLearned)![1],
            status: learned
              ? "LEARNED"
              : partial
                ? "LEARNED_PARTIAL"
                : "NOT_LEARNED",
            date: learned ? learned[1] : partial ? partial[1] : undefined,
            subpointers: [],
            _rawLines: [line],
          };
          progress[currentChapter].push(currentItem);
        } else {
          currentItem = null;
        }
      } else if (currentItem && /^    - /.test(line)) {
        currentItem._rawLines.push(line);
        // Parse subpointer
        const sub = line.slice(6);
        const subLearned = sub.match(/^LEARNED \(([^)]+)\) - (.+)$/);
        const subNotLearned = sub.match(/^NOT_LEARNED - (.+)$/);
        const subMisunderstanding = sub.match(
          /^MISUNDERSTANDING \(([^)]+) to ([^)]+)\) - (.+)$/,
        );

        if (subLearned) {
          currentItem.subpointers.push({
            text: subLearned[2],
            status: "LEARNED",
            date: subLearned[1],
          });
        } else if (subNotLearned) {
          currentItem.subpointers.push({
            text: subNotLearned[1],
            status: "NOT_LEARNED",
          });
        } else if (subMisunderstanding) {
          currentItem.subpointers.push({
            text: subMisunderstanding[3],
            status: "MISUNDERSTANDING",
            from: subMisunderstanding[1],
            to: subMisunderstanding[2],
          });
        }
      } else if (line.trim()) {
        currentItem = null;
      }
    }

    if (section === "misunderstandings") {
      const m = line.match(
        /^- (ACTIVE|CLEARED) \(([^)]+) to ([^)]+)\) - (.+)$/,
      );
      if (m) {
        misunderstandings.push({
          status: m[1],
          from: m[2],
          to: m[3],
          text: m[4],
        });
      }
    }

    if (section === "bonuses") {
      const m = line.match(/^- \(([^)]+)\) - (.+)$/);
      if (m) bonuses.push({ date: m[1], text: m[2] });
    }

    if (section === "unknown") {
      const m = line.match(/^- \(([^)]+)\) - (.+)$/);
      if (m) unknown.push({ date: m[1], text: m[2] });
    }
  }

  // Clean up internal _rawLines
  for (const items of Object.values(progress)) {
    for (const item of items) {
      delete item._rawLines;
    }
  }

  return { checksum, progress, misunderstandings, bonuses, unknown };
}

// ── Chapter file parser ────────────────────────────────────────────────────────
//
// Parses a chapter file into { title, summary, items }.
// Format:
//   # Chapter N: Title
//   Summary paragraph(s).
//   ## Checklist
//   - item text
//   - item text

function parseChapter(raw: string) {
  const lines = raw.split("\n");

  // Title: first # heading
  let title = "";
  for (const line of lines) {
    const m = line.match(/^# (.+)$/);
    if (m) {
      title = m[1].trim();
      break;
    }
  }

  // Summary: text between # heading and ## Checklist
  let summary = "";
  let pastTitle = false;
  for (const line of lines) {
    if (!pastTitle && /^# /.test(line)) {
      pastTitle = true;
      continue;
    }
    if (pastTitle) {
      if (line.trim() === "## Checklist") break;
      if (line.trim()) summary += (summary ? " " : "") + line.trim();
    }
  }

  // Checklist items
  const items = [];
  let inChecklist = false;
  for (const line of lines) {
    if (line.trim() === "## Checklist") {
      inChecklist = true;
      continue;
    }
    if (inChecklist && /^## /.test(line)) break;
    if (inChecklist && /^- /.test(line)) {
      items.push(line.slice(2).trim());
    }
  }

  return { title, summary, items };
}

// ── KNOWLEDGE.md helpers ───────────────────────────────────────────────────────

function replaceSection(content: string, header: string, newBlock: string) {
  const marker = `\n${header}\n`;
  const startIdx = content.indexOf(marker);
  if (startIdx === -1) {
    process.stderr.write(
      `WARN: section "${header}" not found in content — appending\n`,
    );
    return content + `\n${header}\n${newBlock}`;
  }
  const afterHeader = startIdx + marker.length;
  const nextSection = content.indexOf("\n## ", afterHeader);
  const end = nextSection !== -1 ? nextSection : content.length;
  return (
    content.slice(0, startIdx + 1) +
    header +
    "\n" +
    newBlock +
    content.slice(end)
  );
}

export function reconcileKnowledge(courseId: string): { added: number; removed: number } {
  const root = repoRoot();
  const courseDir = courseDirById(courseId);
  if (!courseDir || !fs.existsSync(courseDir) || !fs.statSync(courseDir).isDirectory()) {
    process.stderr.write(
      `WARN: course dir not found for reconcile: ${courseDir}\n`,
    );
    return { added: 0, removed: 0 };
  }

  const progressDir = path.join(root, "progress", courseId);
  const knowledgePath = path.join(progressDir, "KNOWLEDGE.md");
  const newChecksum = computeChecksum(courseDir);
  const curriculum = parseChapters(courseDir);

  let content;
  if (fs.existsSync(knowledgePath)) {
    content = fs.readFileSync(knowledgePath, "utf8");
  } else {
    fs.mkdirSync(progressDir, { recursive: true });
    content = `[//]: # (curriculum-checksum: none)\n\n## Main Progress\n\n## Bonuses\n\n## Misunderstandings\n\n## Unknown\n`;
    process.stderr.write(
      `INFO: bootstrapping KNOWLEDGE.md at ${knowledgePath}\n`,
    );
  }

  const { progress: existing } = parseKnowledge(content);
  const added = [],
    removedItems = [],
    newBonusLines = [];

  const mainLines = [];
  for (const [slug, chapter] of Object.entries(curriculum)) {
    mainLines.push(`- ${slug}:`);
    const prev = existing[slug] || [];
    for (const text of chapter.items) {
      const match = prev.find((e: any) => e.text === text);
      if (match) {
        mainLines.push(formatProgressLine(match));
        if (match.subpointers && match.subpointers.length > 0) {
          for (const sp of match.subpointers) {
            mainLines.push(formatSubpointerLine(sp));
          }
        }
      } else {
        mainLines.push(`  - NOT_LEARNED - ${text}`);
        added.push({ slug, text });
      }
    }
  }

  for (const [slug, items] of Object.entries(existing)) {
    for (const item of items) {
      if (!curriculum[slug]?.items?.includes(item.text)) {
        removedItems.push({ slug, ...item });
        if (item.status === "LEARNED" || item.status === "LEARNED_PARTIAL") {
          newBonusLines.push(
            `- (${today()}) - [removed from curriculum] ${item.text}`,
          );
        }
      }
    }
  }

  let out = content;
  out = out.replace(
    /^\[\/\/\]: # \(curriculum-checksum: [^)]*\)/m,
    `[//]: # (curriculum-checksum: ${newChecksum})`,
  );
  out = replaceSection(
    out,
    "## Main Progress",
    "\n" + mainLines.join("\n") + "\n",
  );
  if (newBonusLines.length) {
    out = out.replace(
      /^## Bonuses$/m,
      `## Bonuses\n\n${newBonusLines.join("\n")}`,
    );
  }

  fs.writeFileSync(knowledgePath, out, "utf8");
  return { added: added.length, removed: removedItems.length };
}

function formatProgressLine(item: any): string {
  if (item.status === "LEARNED")
    return `  - LEARNED (${item.date}) - ${item.text}`;
  if (item.status === "LEARNED_PARTIAL")
    return `  - LEARNED_PARTIAL (${item.date}) - ${item.text}`;
  return `  - NOT_LEARNED - ${item.text}`;
}

function formatSubpointerLine(sp: any): string {
  if (sp.status === "LEARNED") return `    - LEARNED (${sp.date}) - ${sp.text}`;
  if (sp.status === "NOT_LEARNED") return `    - NOT_LEARNED - ${sp.text}`;
  if (sp.status === "MISUNDERSTANDING")
    return `    - MISUNDERSTANDING (${sp.from} to ${sp.to}) - ${sp.text}`;
  return `    - NOT_LEARNED - ${sp.text}`;
}

// ── Course discovery ───────────────────────────────────────────────────────────
//
// Walks courses/ recursively to find all course directories (those with course.json).
// Returns [{ id, path, title, description }]

export function discoverCourses() {
  const root = repoRoot();
  const coursesDir = path.join(root, "courses");
  if (!fs.existsSync(coursesDir)) return [];

  const results: { id: string | null; path: string; title: string; description: string }[] = [];
  function walk(dir: string) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    // Check if this directory itself is a course
    const courseJsonPath = path.join(dir, "course.json");
    if (fs.existsSync(courseJsonPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(courseJsonPath, "utf8"));
        const id = meta.id || null;
        const relPath = path.relative(coursesDir, dir);
        results.push({
          id,
          path: relPath,
          title: meta.title || relPath,
          description: meta.description || "",
        });
      } catch {
        /* skip invalid course.json */
      }
      // Don't descend into course directories
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        walk(path.join(dir, entry.name));
      }
    }
  }
  walk(coursesDir);
  return results;
}

export function courseDirById(courseId: string): string | null {
  const root = repoRoot();
  const coursesDir = path.join(root, "courses");

  function search(dir: string): string | null {
    const courseJsonPath = path.join(dir, "course.json");
    if (fs.existsSync(courseJsonPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(courseJsonPath, "utf8"));
        if (meta.id === courseId) return dir;
      } catch { /* skip */ }
      return null;
    }
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const found = search(path.join(dir, entry.name));
      if (found) return found;
    }
    return null;
  }

  return search(coursesDir) || null;
}

function progressDirById(courseId: string): string {
  return path.join(repoRoot(), "progress", courseId);
}

export function knowledgePathById(courseId: string): string {
  return path.join(repoRoot(), "progress", courseId, "KNOWLEDGE.md");
}

// ── Chapter directory parser ───────────────────────────────────────────────────
//
// Reads all chapter-*.md files in a course directory.
// Returns { chapterSlug: { title, summary, items: [string] } }

export function parseChapters(courseDir: string): Record<string, { slug: string; title: string; summary: string; items: string[] }> {
  if (!fs.existsSync(courseDir) || !fs.statSync(courseDir).isDirectory()) {
    return {};
  }

  const files = fs
    .readdirSync(courseDir)
    .filter((f) => /^chapter-.+\.md$/.test(f));
  const chapters: Record<string, any> = {};
  for (const file of files.sort()) {
    const slug = file.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(courseDir, file), "utf8");
    const parsed = parseChapter(raw);
    chapters[slug] = {
      title: parsed.title,
      summary: parsed.summary,
      items: parsed.items,
    };
  }
  return chapters;
}

// ── Scoring engine ─────────────────────────────────────────────────────────────
//
// Scores NOT_LEARNED and LEARNED_PARTIAL items for ZPD ordering.
//
// Priority:
//   1. LEARNED_PARTIAL → +10
//   2. Same chapter as LEARNED item → +5
//   3. Keyword overlap with any LEARNED item → +3
//   4. Touched in recent session (last 7 days) → -3
//   5. Chapter order → +0-3 (tiebreaker, earlier chapters score higher)

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "shall",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "and",
  "but",
  "or",
  "nor",
  "not",
  "so",
  "yet",
  "both",
  "either",
  "neither",
  "each",
  "every",
  "all",
  "any",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "only",
  "own",
  "same",
  "than",
  "too",
  "very",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "they",
  "them",
  "their",
  "what",
  "which",
  "who",
  "whom",
  "when",
  "where",
  "why",
  "how",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/[\s-]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function jaccardSimilarity(tokensA: string[], tokensB: string[]) {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

function getRecentLessonItems(courseId: string): Set<string> {
  const root = repoRoot();
  const lessonsDir = path.join(root, ".beacon", "lessons", courseId);
  if (!fs.existsSync(lessonsDir)) return new Set();

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentItems = new Set<string>();

  for (const dir of fs.readdirSync(lessonsDir)) {
    const progressPath = path.join(lessonsDir, dir, "lesson-progress.json");
    if (!fs.existsSync(progressPath)) continue;
    const stat = fs.statSync(progressPath);
    if (stat.mtimeMs < cutoff) continue;

    try {
      const progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));
      if (progress.questions) {
        for (const q of Object.values(progress.questions) as any[]) {
          if (q.questionText) recentItems.add(q.questionText as string);
        }
      }
    } catch {
      /* skip invalid JSON */
    }
  }

  return recentItems;
}

export function scoreItems(courseId: string): { text: string; status: string; chapter: string; score: number }[] {
  const root = repoRoot();
  const knowledgePath = path.join(root, "progress", courseId, "KNOWLEDGE.md");
  if (!fs.existsSync(knowledgePath)) {
    die(`KNOWLEDGE.md not found for course: ${courseId}`);
  }

  const content = fs.readFileSync(knowledgePath, "utf8");
  const { progress } = parseKnowledge(content);
  const courseDir = courseDirById(courseId);
  if (!courseDir) return [];
  const chapters = parseChapters(courseDir);

  // Collect all LEARNED item texts (for keyword overlap)
  const learnedTexts = [];
  const learnedChapters = new Set();
  for (const [chapterSlug, items] of Object.entries(progress)) {
    for (const item of items) {
      if (item.status === "LEARNED") {
        learnedTexts.push(item.text);
        learnedChapters.add(chapterSlug);
      }
    }
  }

  // Tokenize all LEARNED items once
  const learnedTokens = learnedTexts.map((t) => tokenize(t));

  // Check recent lessons
  const recentItems = getRecentLessonItems(courseId);

  // Rank chapters by order for tiebreaker
  const chapterOrder = Object.keys(chapters);
  const chapterRank: Record<string, number> = {};
  chapterOrder.forEach((slug, i) => {
    chapterRank[slug] = chapterOrder.length - i;
  });

  // Score each NOT_LEARNED / LEARNED_PARTIAL item
  const scored = [];

  for (const [chapterSlug, items] of Object.entries(progress)) {
    for (const item of items) {
      if (item.status === "LEARNED") continue;

      let score = 0;

      // 1. LEARNED_PARTIAL boost
      if (item.status === "LEARNED_PARTIAL") score += 10;

      // 2. Same chapter as a LEARNED item
      if (learnedChapters.has(chapterSlug)) score += 5;

      // 3. Keyword overlap with LEARNED items
      const itemTokens = tokenize(item.text);
      if (itemTokens.length > 0) {
        let maxOverlap = 0;
        for (const lt of learnedTokens) {
          const sim = jaccardSimilarity(itemTokens, lt);
          if (sim > maxOverlap) maxOverlap = sim;
        }
        if (maxOverlap > 0.15) score += 3;
      }

      // 4. Recent session deprioritization
      if (recentItems.has(item.text)) score -= 3;

      // 5. Chapter order tiebreaker
      score += (chapterRank[chapterSlug] || 0) * 0.01;

      scored.push({
        text: item.text,
        chapter: chapterSlug,
        status: item.status,
        score,
      });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Round scores to 2 decimal places
  for (const s of scored) {
    s.score = Math.round(s.score * 100) / 100;
  }

  return scored;
}


// ── YAML emitter ───────────────────────────────────────────────────────────────

export function emitYaml(obj: unknown): string {
  return dump(obj, {  });
}
