import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { confirm } from "@inquirer/prompts";
import { object, or } from "@optique/core/constructs";
import { optional } from "@optique/core/modifiers";
import { argument, constant, option } from "@optique/core/primitives";
import { string } from "@optique/core/valueparser";
import { message } from "@optique/core/message";
import { defineCommand } from "@optique/discover";
import * as u from "./util.js";
import * as lib from "./lib.js";

// ── git check ──────────────────────────────────────────────────────────────────

const gitCheck = spawnSync("which", ["git"], { encoding: "utf8" });
if (gitCheck.status !== 0) {
  process.stderr.write(
    "Git is required to download and update courses.\nInstall it from https://git-scm.com\n",
  );
  process.exit(1);
}

// ── write course files from remote ────────────────────────────────────────────

function writeCourseFromRemote(
  remoteName: string,
  branch: string,
  sourcePath: string,
  localDir: string,
) {
  const files = u.listRemotePaths(remoteName, branch, sourcePath);
  if (files.length === 0) {
    u.die(
      `no files found at ${remoteName}/${branch}:${sourcePath}\nCheck that the course path exists in the remote`,
    );
  }
  let written = 0;
  const fullLocalDir = path.join(u.getRepoRoot(), "courses", localDir);
  for (const remotePath of files) {
    const relative = remotePath.slice(sourcePath.length + 1);
    const localPath = path.join(fullLocalDir, relative);
    const content = u.gitShow(`${remoteName}/${branch}`, remotePath);
    if (content === null) continue;
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, content, "utf8");
    written++;
  }
  return written;
}

// ── beacon courses install ────────────────────────────────────────────────────

const coursesInstall = defineCommand({
  path: ["courses", "install"],
  parser: object({
    source: optional(argument(string({ metavar: "SOURCE" }))),
    course: optional(argument(string({ metavar: "COURSE" }))),
    alias: optional(argument(string({ metavar: "ALIAS" }))),
  }),
  metadata: { brief: message`Install courses from a GitHub repo or from the lock file.` },
  async handler({ source, course, alias }) {
    // No source → install all from lock
    if (!source) {
      const lock = u.readLock();
      const entries = Object.entries(lock);
      if (entries.length === 0) {
        console.log("no courses in lock — nothing to install");
        process.exit(0);
      }
      for (const [id, entry] of entries) {
        const { remote, sourcePath } = entry as any;
        const [username, localName] = id.split("/");
        await installCourse({ url: remote, username, sourcePath, localName });
      }
      return;
    }

    // Source given → discover and install from remote
    const userRepo = source;
    if (!userRepo) {
      u.die(
        "expected <user>/<repo> or GitHub URL as first argument\nExample: beacon courses add user123/my-learning",
      );
    }

    let normalized = userRepo;
    const ghMatch = userRepo.match(
      /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/,
    );
    if (ghMatch) {
      normalized = `${ghMatch[1]}/${ghMatch[2]}`;
    }

    if (!normalized.includes("/")) {
      u.die(
        "expected <user>/<repo> or GitHub URL as first argument\nExample: beacon courses add user123/my-learning",
      );
    }

    const [username, repoName] = normalized.split("/");
    const url = `https://github.com/${username}/${repoName}`;

    const targetDir = path.join(u.getRepoRoot(), "courses", username);

    // Clone to temp first to discover available courses and verify
    const tmpDir = path.join(os.tmpdir(), `beacon-discover-${Date.now()}`);
    let branch = "main";
    for (const b of ["main", "master"]) {
      const r = u.runSilent(`git clone --depth 1 --single-branch --branch ${b} ${url} ${tmpDir}`);
      if (r.code === 0) { branch = b; break; }
    }
    if (!fs.existsSync(tmpDir)) {
      u.die(`failed to clone ${url}`);
    }

    // Detect actual branch from clone
    branch = detectBranch(tmpDir) || "main";

    let coursesToAdd;
    if (course) {
      const sourcePath = path.join(tmpDir, course);
      if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        u.die(`course "${course}" not found in ${username}/${repoName}`);
      }
      coursesToAdd = [{ sourcePath: course, localName: alias || course }];
    } else {
      const dirs = fs.readdirSync(tmpDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith("."))
        .filter(d => {
          try {
            return fs.readdirSync(path.join(tmpDir, d.name)).some(f => f.endsWith(".md"));
          } catch { return false; }
        })
        .map(d => d.name);

      if (dirs.length === 0) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        u.die(
          `no directories with .md files found in ${username}/${repoName}`,
        );
      }
      const selected = await u.pickCourses(`${username}/${repoName}`, dirs);
      if (selected.length === 0) {
        console.log("cancelled");
        fs.rmSync(tmpDir, { recursive: true, force: true });
        process.exit(0);
      }
      coursesToAdd = selected.map((d) => ({ sourcePath: d, localName: d }));
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });

    for (const { sourcePath, localName } of coursesToAdd) {
      await installCourse({ url, username, sourcePath, localName, branch });
    }
  },
});

// ── helpers ────────────────────────────────────────────────────────────────────

function courseDirForLock(courseId: string): string {
  return path.join(u.getRepoRoot(), "courses", courseId);
}

// ── installCourse helper ────────────────────────────────────────────────────────

async function installCourse({
  url,
  username,
  sourcePath,
  localName,
  branch = "main",
}: {
  url: string;
  username: string;
  sourcePath: string;
  localName: string;
  branch?: string;
}) {
  const courseId = `${username}/${localName}`;
  const courseDir = path.join(
    u.getRepoRoot(),
    "courses",
    username,
    localName,
  );

  // Handle existing
  if (fs.existsSync(courseDir)) {
    const overwrite = await confirm({
      message: `Course "${courseId}" already exists. Update it?`,
      default: false,
    });
    if (!overwrite) {
      console.log(`  skipped — ${courseId} already installed`);
      return;
    }
    fs.rmSync(courseDir, { recursive: true, force: true });
  }

  fs.mkdirSync(path.dirname(courseDir), { recursive: true });
  console.log(`installing ${courseId}...`);

  // Clone with sparse checkout
  const cloneResult = u.runSilent(
    `git clone --depth 1 --filter=blob:none --sparse ${url} ${courseDir}`,
  );
  if (cloneResult.code !== 0) {
    u.die(`git clone failed for ${courseId}`);
  }
  u.runSilent(`git sparse-checkout set ${sourcePath}`, { cwd: courseDir });

  // Move files up from nested sourcePath dir
  const nestedDir = path.join(courseDir, sourcePath);
  if (fs.existsSync(nestedDir) && fs.statSync(nestedDir).isDirectory()) {
    for (const f of fs.readdirSync(nestedDir)) {
      fs.renameSync(path.join(nestedDir, f), path.join(courseDir, f));
    }
    fs.rmdirSync(nestedDir);
  }

  // Update lock with commit SHA
  const sha = u.revParseDir(courseDir, "HEAD");
  // Read canonical id from course.json
  const courseJsonPath = path.join(courseDir, "course.json");
  let canonicalId = courseId;
  if (fs.existsSync(courseJsonPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(courseJsonPath, "utf8"));
      if (meta.id) canonicalId = meta.id;
    } catch {}
  }

  const lock = u.readLock();
  lock[canonicalId] = { remote: url, branch, sourcePath, commitSha: sha };
  u.writeLock(lock);

  const { added, removed } = lib.reconcileKnowledge(canonicalId);
  console.log(`  installed — KNOWLEDGE.md: +${added}/-${removed}`);
}

// ── beacon courses update ──────────────────────────────────────────────────────

const coursesUpdate = defineCommand({
  path: ["courses", "update"],
  parser: or(
    object({
      all: option("--all"),
      course: constant(undefined as string | undefined),
    }),
    object({
      all: constant(undefined),
      course: argument(string({ metavar: "COURSE" })),
    }),
  ),
  metadata: { brief: message`Update a course to the latest version.` },
  handler(opts) {
    const lock: Record<string, any> = u.readLock();

    let courses;
    if (opts.all) {
      courses = Object.keys(lock);
      if (courses.length === 0) {
        console.log("no remote courses in lock — nothing to update");
        process.exit(0);
      }
    } else if (opts.course) {
      if (!lock[opts.course])
        u.die(
          `course "${opts.course}" not found in courses-lock.json\nLocal-only courses cannot be updated. Use "add" to track a remote course.`,
        );
      courses = [opts.course];
    } else {
      u.die("usage: beacon courses update <course> | --all");
    }

    let anyConflict = false;

    for (const courseId of courses) {
      const { branch, commitSha } = lock[courseId] as any;
      const courseDir = courseDirForLock(courseId);
      if (!courseDir || !fs.existsSync(path.join(courseDir, ".git"))) {
        process.stderr.write(
          `WARN: ${courseId} has no local git — skipping\n`,
        );
        continue;
      }

      console.log(`\nupdating ${courseId}...`);

      // Fetch from origin
      const fetchResult = u.runSilent(`git fetch origin`, { cwd: courseDir });
      if (fetchResult.code !== 0) {
        process.stderr.write(
          `WARN: git fetch failed for ${courseId}\n`,
        );
        continue;
      }

      const newSha = u.revParseDir(courseDir, `origin/${branch}`);
      if (!newSha) {
        process.stderr.write(
          `WARN: could not resolve origin/${branch} for ${courseId}\n`,
        );
        continue;
      }
      if (newSha === commitSha) {
        console.log(`  ${courseId}: already up to date`);
        continue;
      }

      // Try fast-forward merge
      const mergeResult = u.runSilent(
        `git merge --ff-only origin/${branch}`,
        { cwd: courseDir },
      );
      if (mergeResult.code === 0) {
        lock[courseId].commitSha = newSha;
        u.writeLock(lock);
        const { added, removed } = lib.reconcileKnowledge(courseId);
        console.log(
          `  ${courseId}: updated — KNOWLEDGE.md: +${added}/-${removed}`,
        );
      } else {
        // Attempt merge, may produce conflicts
        const mergeResult2 = u.runSilent(
          `git merge origin/${branch}`,
          { cwd: courseDir },
        );
        if (mergeResult2.code === 0) {
          lock[courseId].commitSha = newSha;
          u.writeLock(lock);
          const { added, removed } = lib.reconcileKnowledge(courseId);
          console.log(
            `  ${courseId}: merged — KNOWLEDGE.md: +${added}/-${removed}`,
          );
        } else {
          anyConflict = true;
          console.log(`  ${courseId}: CONFLICTS — resolve in ${courseDir}, then run:\n    git -C ${courseDir} add . && git -C ${courseDir} merge --continue\n  then update KNOWLEDGE.md manually`);
        }
      }
    }

    if (anyConflict) {
      process.stderr.write(
        "\nSome courses have conflicts. Resolve them and re-run update.\n",
      );
      process.exit(1);
    }
  },
});

// ── beacon courses remove ──────────────────────────────────────────────────────

const coursesRemove = defineCommand({
  path: ["courses", "remove"],
  parser: object({ courseId: argument(string({ metavar: "COURSE" })) }),
  metadata: { brief: message`Remove a course.` },
  handler({ courseId }) {
    if (!courseId) u.die("usage: beacon courses remove <course-id>");
    const lock = u.readLock();
    if (!lock[courseId])
      u.die(
        `course "${courseId}" not found in courses-lock.json\nOnly remote-tracked courses can be removed from the lock. Files are kept on disk.`,
      );
    delete lock[courseId];
    u.writeLock(lock);
    console.log(
      `removed "${courseId}" from courses-lock.json (files kept on disk)`,
    );
  },
});

// ── beacon courses list ────────────────────────────────────────────────────────

const coursesList = defineCommand({
  path: ["courses", "list"],
  parser: object({}),
  metadata: { brief: message`List installed courses.` },
  handler() {
    const courses = lib.discoverCourses();
    if (courses.length === 0) {
      console.log(lib.emitYaml([]));
      return;
    }

    const lock = u.readLock();
    const rows = [];
    for (const c of courses.sort((a, b) =>
      (a.id || "").localeCompare(b.id || ""),
    )) {
      const entry = lock[c.id as string];
      rows.push({
        id: c.id,
        title: c.title,
        source: entry ? "remote" : "local",
        commit: entry ? (entry as any).commitSha?.slice(0, 7) : null,
      });
    }
    console.log(lib.emitYaml(rows));
  },
});

// ── beacon courses check ───────────────────────────────────────────────────────

const coursesCheck = defineCommand({
  path: ["courses", "check"],
  parser: object({ courseId: argument(string({ metavar: "COURSE" })) }),
  metadata: { brief: message`Check for upstream updates.` },
  handler({ courseId }) {
    if (!courseId) u.die("usage: beacon courses check <course-id>");
    const lock = u.readLock();

    if (!lock[courseId]) {
      console.log(`${courseId}: local — no remote to check`);
      process.exit(0);
    }

    const { remoteName, branch, commitSha, sourcePath } = lock[courseId] as any;
    const fetchResult = u.runSilent(`git fetch ${remoteName}`);
    if (fetchResult.code !== 0) {
      console.log(`${courseId}: fetch failed — assuming up to date`);
      process.exit(0);
    }

    const newSha = u.revParse(`${remoteName}/${branch}`);
    if (!newSha) {
      console.log(
        `${courseId}: could not resolve ${remoteName}/${branch} — assuming up to date`,
      );
      process.exit(0);
    }
    if (newSha === commitSha) {
      console.log(`${courseId}: up to date`);
      process.exit(0);
    }

    const changedFiles = u.runSilent(
      `git diff --name-only "${commitSha}" "${remoteName}/${branch}" -- "${sourcePath}/"`,
    );
    const commits = u.runSilent(
      `git log --oneline "${commitSha}".."${remoteName}/${branch}" -- "${sourcePath}/"`,
    );

    console.log(`${courseId}: updates available\n`);
    if (changedFiles.stdout)
      console.log(`Changed files:\n${changedFiles.stdout}`);
    if (commits.stdout) console.log(`\nNew commits:\n${commits.stdout}`);
    process.exit(1);
  },
});

export const courseCommands = [
  coursesInstall,
  coursesUpdate,
  coursesRemove,
  coursesList,
  coursesCheck,
];
