import fs from "node:fs";
import path from "node:path";
import { object } from "@optique/core/constructs";
import { defineCommand } from "@optique/discover";
import { message } from "@optique/core/message";
import * as lib from "./lib.js";

const INBOX = path.join(lib.repoRoot(), ".beacon", "inbox.jsonl");

const clear = defineCommand({
  path: ["inbox", "clear"],
  parser: object({}),
  metadata: {
    brief: message`Truncate the shared inbox file.`,
  },
  handler() {
    fs.writeFileSync(INBOX, "");
    process.stderr.write("Inbox cleared.\n");
  },
});

export const inboxCommands = [clear];
