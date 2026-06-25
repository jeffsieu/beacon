import fs from "node:fs";
import { object } from "@optique/core/constructs";
import { argument } from "@optique/core/primitives";
import { string } from "@optique/core/valueparser";
import { message } from "@optique/core/message";
import { defineCommand } from "@optique/discover";
import * as lib from "./lib.js";

const statusCourse = defineCommand({
  path: ["status"],
  parser: object({ courseId: argument(string({ metavar: "COURSE" })) }),
  metadata: {
    brief: message`Show curriculum checksum, progress, and scored items.`,
  },
  handler({ courseId }) {
    const knowledgePath = lib.knowledgePathById(courseId);
    const courseDir = lib.courseDirById(courseId);
    if (!courseDir || !fs.existsSync(courseDir))
      lib.die(`course "${courseId}" not found`);
    if (!fs.existsSync(knowledgePath))
      lib.die(`no progress found for course "${courseId}"`);
    const knowledgeRaw = fs.readFileSync(knowledgePath, "utf8");
    const { checksum: storedChecksum, progress } =
      lib.parseKnowledge(knowledgeRaw);
    const chapters = lib.parseChapters(courseDir);
    const scored = lib.scoreItems(courseId);
    const currentChecksum = lib.computeChecksum(courseDir);
    const drift = storedChecksum !== currentChecksum;
    const output = {
      checksum: { stored: storedChecksum, current: currentChecksum, drift },
      progress,
      scored,
      chapters,
    };
    if (drift)
      process.stderr.write(
        `WARNING: curriculum checksum drift detected. Run "beacon sync ${courseId}" to reconcile.\n`,
      );
    process.stdout.write(lib.emitYaml(output));
  },
});

const progress = defineCommand({
  path: ["progress"],
  parser: object({ courseId: argument(string({ metavar: "COURSE" })) }),
  metadata: { brief: message`Print KNOWLEDGE.md as YAML.` },
  handler({ courseId }) {
    const knowledgePath = lib.knowledgePathById(courseId);
    if (!fs.existsSync(knowledgePath))
      lib.die(`no progress found for course "${courseId}"`);
    process.stdout.write(
      lib.emitYaml({
        progress: lib.parseKnowledge(fs.readFileSync(knowledgePath, "utf8"))
          .progress,
      }),
    );
  },
});

const sync = defineCommand({
  path: ["sync"],
  parser: object({ courseId: argument(string({ metavar: "COURSE" })) }),
  metadata: {
    brief: message`Reconcile KNOWLEDGE.md against current curriculum.`,
  },
  handler({ courseId }) {
    const courseDir = lib.courseDirById(courseId);
    if (!courseDir || !fs.existsSync(courseDir))
      lib.die(`course "${courseId}" not found`);
    const knowledgePath = lib.knowledgePathById(courseId);
    if (fs.existsSync(knowledgePath)) {
      const { checksum: stored } = lib.parseKnowledge(
        fs.readFileSync(knowledgePath, "utf8"),
      );
      const current = lib.computeChecksum(courseDir);
      if (stored !== current) process.stderr.write(`DRIFT: reconciling…\n`);
      else process.stderr.write("Checksum matches. No drift.\n");
    }
    console.log(lib.emitYaml(lib.reconcileKnowledge(courseId)));
  },
});

export const statusCommands = [
  statusCourse,
  progress,
  sync,
];
