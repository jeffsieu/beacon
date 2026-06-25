import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

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

export async function pickCourses(
  remoteName: string,
  dirs: string[],
): Promise<string[]> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    console.log(`\nAvailable courses in ${remoteName}:`);
    dirs.forEach((d, i) => console.log(`  ${i + 1}. ${d}`));
    rl.question(
      '\nEnter numbers (e.g. 1,3), "all", or Enter to cancel:\n> ',
      (answer) => {
        rl.close();
        if (!answer.trim()) {
          resolve([]);
          return;
        }
        if (answer.trim().toLowerCase() === "all") {
          resolve(dirs);
          return;
        }
        const indices = answer
          .split(",")
          .map((s) => parseInt(s.trim(), 10) - 1);
        const selected = indices
          .filter((i) => i >= 0 && i < dirs.length)
          .map((i) => dirs[i]);
        if (selected.length === 0) {
          console.log("No valid selection — cancelled.");
          resolve([]);
        } else resolve(selected);
      },
    );
  });
}

// ── error ──────────────────────────────────────────────────────────────────────

export function die(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(1);
}
