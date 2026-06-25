import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ── repo root ──────────────────────────────────────────────────────────────────

let repoRoot: string;
try {
  repoRoot = execSync("git rev-parse --show-toplevel", {
    encoding: "utf8",
    stdio: "pipe",
  }).trim();
} catch {
  repoRoot = process.cwd();
}

export function getRepoRoot(): string {
  return repoRoot;
}

export function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --git-dir", {
      encoding: "utf8",
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

// ── lock file ──────────────────────────────────────────────────────────────────

export const lockPath = path.join(repoRoot, "courses-lock.json");

export function readLock(): Record<string, unknown> {
  if (!fs.existsSync(lockPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(lockPath, "utf8"));
  } catch (e: unknown) {
    die(
      `courses-lock.json is invalid JSON: ${(e as Error).message}\nFix or delete ${lockPath}`,
    );
  }
}

export function writeLock(lock: Record<string, unknown>): void {
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n", "utf8");
}

// ── git helpers ────────────────────────────────────────────────────────────────

export function run(cmd: string, opts: Record<string, unknown> = {}): string {
  return execSync(cmd, {
    encoding: "utf8",
    stdio: "pipe",
    ...opts,
  } as any) as string;
}

export function runSilent(
  cmd: string,
  opts: Record<string, unknown> = {},
): { code: number; stdout: string; stderr: string } {
  const result = spawnSync("sh", ["-c", cmd], {
    encoding: "utf8",
    cwd: repoRoot,
    ...opts,
  } as any);
  return {
    code: result.status ?? 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

export function getRemotes(): Record<string, string> {
  try {
    const out = run("git remote -v", { cwd: repoRoot });
    const remotes: Record<string, string> = {};
    for (const line of out.split("\n")) {
      const m = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)/);
      if (m) remotes[m[1]] = m[2];
    }
    return remotes;
  } catch {
    return {};
  }
}

export function detectDefaultBranch(remoteName: string): string {
  for (const branch of ["main", "master"]) {
    const r = runSilent(
      `git show-ref --verify --quiet refs/remotes/${remoteName}/${branch}`,
    );
    if (r.code === 0) return branch;
  }
  die(
    `cannot detect default branch for remote "${remoteName}" — neither main nor master found\nRun: git fetch ${remoteName}`,
  );
}

export function gitShow(ref: string, filePath: string): string | null {
  const r = runSilent(`git show "${ref}:${filePath}"`);
  if (r.code !== 0) return null;
  return r.stdout;
}

export function revParseDir(dir: string, ref: string): string | null {
  const r = runSilent(`git rev-parse "${ref}"`, { cwd: dir });
  if (r.code !== 0) return null;
  return r.stdout.trim();
}

export function revParse(ref: string): string | null {
  const r = runSilent(`git rev-parse "${ref}"`);
  if (r.code !== 0) return null;
  return r.stdout;
}

export function listRemotePaths(
  remoteName: string,
  branch: string,
  prefix: string,
): string[] {
  const ref = `${remoteName}/${branch}`;
  const r = runSilent(`git ls-tree -r --name-only "${ref}" "${prefix}/"`);
  if (r.code !== 0) return [];
  return r.stdout ? r.stdout.split("\n").filter(Boolean) : [];
}

export function listRemoteTopDirs(
  remoteName: string,
  branch: string,
): string[] {
  const ref = `${remoteName}/${branch}`;
  const r = runSilent(`git ls-tree -r --name-only "${ref}"`);
  if (r.code !== 0) return [];
  const dirs = new Set<string>();
  for (const f of r.stdout.split("\n").filter(Boolean)) {
    const parts = f.split("/");
    if (parts.length >= 2 && f.endsWith(".md")) dirs.add(parts[0]);
  }
  return [...dirs].sort();
}

// ── interactive picker ─────────────────────────────────────────────────────────

import { checkbox, confirm } from "@inquirer/prompts";

export async function pickCourses(
  remoteName: string,
  dirs: string[],
): Promise<string[]> {
  const selected = await checkbox({
    message: `Select courses from ${remoteName}:`,
    choices: dirs.map((d) => ({ name: d, value: d })),
    instructions: "(space to select, enter to confirm)",
  });
  if (selected.length === 0) {
    console.log("cancelled");
    return [];
  }
  return selected;
}

// ── error ──────────────────────────────────────────────────────────────────────

export function die(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}
