import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

// ── beacon courses add ─────────────────────────────────────────────────────────

const coursesAdd = defineCommand({
  path: ["courses", "add"],
  parser: object({
    source: argument(string({ metavar: "SOURCE" })),
    course: optional(argument(string({ metavar: "COURSE" }))),
    alias: optional(argument(string({ metavar: "ALIAS" }))),
  }),
  metadata: { brief: message`Add a course from a GitHub repo or URL.` },
  async handler({ source, course, alias }) {
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
    const remoteName = username;

    const remotes = u.getRemotes();
    if (remotes[remoteName]) {
      if (remotes[remoteName] !== url) {
        u.die(
          `remote "${remoteName}" already exists with a different URL: ${remotes[remoteName]}\nRemove it first: git remote remove ${remoteName}`,
        );
      }
      console.log(`remote "${remoteName}" already exists — skipping add`);
    } else {
      u.run(`git remote add ${remoteName} ${url}`, { cwd: u.getRepoRoot() });
      console.log(`added remote "${remoteName}" → ${url}`);
    }

    console.log(`fetching ${remoteName}...`);
    try {
      u.run(`git fetch ${remoteName}`, {
        cwd: u.getRepoRoot(),
        stdio: "inherit",
      });
    } catch (err: unknown) {
      const e = err as Error;
      u.die(
        `git fetch failed: ${e.message.split("\n")[0]}\nCheck the URL or your network connection`,
      );
    }

    const branch = u.detectDefaultBranch(remoteName);

    let coursesToAdd;
    if (course) {
      coursesToAdd = [{ sourcePath: course, localName: alias || course }];
    } else {
      const dirs = u.listRemoteTopDirs(remoteName, branch);
      if (dirs.length === 0) {
        u.die(
          `no root-level directories with .md files found in ${remoteName}/${branch}\nThe remote repo may have a different structure`,
        );
      }
      const selected = await u.pickCourses(`${username}/${repoName}`, dirs);
      if (selected.length === 0) {
        console.log("cancelled");
        process.exit(0);
      }
      coursesToAdd = selected.map((d) => ({ sourcePath: d, localName: d }));
    }

    const lock = u.readLock();

    for (const { sourcePath, localName } of coursesToAdd) {
      const courseId = `${username}/${localName}`;
      console.log(`\nadding course: ${sourcePath} → ${courseId}`);
      const written = writeCourseFromRemote(
        remoteName,
        branch,
        sourcePath,
        courseId,
      );
      if (written === 0) {
        process.stderr.write(
          `WARN: no files written for course "${sourcePath}"\n`,
        );
        continue;
      }
      const sha = u.revParse(`${remoteName}/${branch}`);
      lock[courseId] = {
        remote: url,
        remoteName,
        branch,
        sourcePath,
        commitSha: sha,
      };
      u.writeLock(lock);
      const { added, removed } = lib.reconcileKnowledge(courseId);
      console.log(
        `  wrote ${written} file(s), KNOWLEDGE.md: +${added} added, -${removed} removed`,
      );
    }
  },
});

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
      const { remoteName, branch, sourcePath, commitSha } =
        lock[courseId] as any;
      console.log(`\nupdating ${courseId} from ${remoteName}/${branch}...`);

      try {
        u.run(`git fetch ${remoteName}`, {
          cwd: u.getRepoRoot(),
          stdio: "inherit",
        });
      } catch {
        process.stderr.write(
          `WARN: git fetch ${remoteName} failed — skipping ${courseId}\n`,
        );
        continue;
      }

      const newSha = u.revParse(`${remoteName}/${branch}`);
      if (!newSha) {
        process.stderr.write(
          `WARN: could not resolve ${remoteName}/${branch} — skipping\n`,
        );
        continue;
      }
      if (newSha === commitSha) {
        console.log(`  ${courseId}: already up to date`);
        continue;
      }

      const remoteFiles = u.listRemotePaths(remoteName, branch, sourcePath);
      if (remoteFiles.length === 0) {
        process.stderr.write(
          `WARN: no files found at ${remoteName}/${branch}:${sourcePath}\n`,
        );
        continue;
      }

      const conflictFiles = [];
      let written = 0,
        skipped = 0;

      for (const remotePath of remoteFiles) {
        const relative = remotePath.slice(sourcePath.length + 1);
        const localPath = path.join(
          u.getRepoRoot(),
          "courses",
          courseId,
          relative,
        );
        const theirs = u.gitShow(`${remoteName}/${branch}`, remotePath);
        if (theirs === null) continue;

        const base = u.gitShow(commitSha, remotePath);
        const ours = fs.existsSync(localPath)
          ? fs.readFileSync(localPath, "utf8")
          : null;

        if (base === null || ours === null) {
          fs.mkdirSync(path.dirname(localPath), { recursive: true });
          fs.writeFileSync(localPath, theirs, "utf8");
          written++;
          continue;
        }
        if (base === theirs) {
          skipped++;
          continue;
        }
        if (base === ours) {
          fs.writeFileSync(localPath, theirs, "utf8");
          written++;
          continue;
        }

        const tmpBase = path.join(
          os.tmpdir(),
          `beacon-base-${Date.now()}-${path.basename(relative)}`,
        );
        const tmpTheirs = path.join(
          os.tmpdir(),
          `beacon-theirs-${Date.now()}-${path.basename(relative)}`,
        );
        fs.writeFileSync(tmpBase, base, "utf8");
        fs.writeFileSync(tmpTheirs, theirs, "utf8");

        const mergeResult = spawnSync(
          "git",
          ["merge-file", localPath, tmpBase, tmpTheirs],
          { cwd: u.getRepoRoot(), encoding: "utf8" },
        );
        fs.unlinkSync(tmpBase);
        fs.unlinkSync(tmpTheirs);

        if (mergeResult.status === 0) {
          written++;
        } else {
          conflictFiles.push(relative);
        }
      }

      if (conflictFiles.length > 0) {
        anyConflict = true;
        console.log(`  ${courseId}: CONFLICTS in:`);
        conflictFiles.forEach((f) => console.log(`    ${f}`));
        console.log(
          `  Resolve conflicts, then re-run: beacon courses update ${courseId}`,
        );
      } else {
        lock[courseId].commitSha = newSha;
        u.writeLock(lock);
        const { added, removed } = lib.reconcileKnowledge(courseId);
        console.log(
          `  ${courseId}: updated — ${written} file(s) written, ${skipped} unchanged, KNOWLEDGE.md: +${added}/-${removed}`,
        );
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
  coursesAdd,
  coursesUpdate,
  coursesRemove,
  coursesList,
  coursesCheck,
];
