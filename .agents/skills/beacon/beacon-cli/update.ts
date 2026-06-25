import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { object } from "@optique/core/constructs";
import { defineCommand } from "@optique/discover";
import { message } from "@optique/core/message";

const skillDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const updateCommand = defineCommand({
  path: ["update"],
  parser: object({}),
  metadata: { brief: message`Update the beacon CLI and agent skill to the latest version.` },
  handler() {
    process.stderr.write("Updating beacon...\n");
    execSync("npx skills update -y beacon", { stdio: "inherit" });
    process.stderr.write("Reinstalling dependencies...\n");
    execSync("npm install", { stdio: "inherit", cwd: skillDir });
    process.stderr.write("Beacon updated.\n");
  },
});
