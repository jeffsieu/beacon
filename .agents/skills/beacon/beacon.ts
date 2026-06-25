#!/usr/bin/env node

import { message } from "@optique/core/message";
import { runProgram } from "@optique/discover";
import { courseCommands } from "./beacon-cli/courses.js";
import { slugCommand } from "./beacon-cli/slug.js";
import { statusCommands } from "./beacon-cli/status.js";
import { inboxCommands } from "./beacon-cli/inbox.js";
import { serverCommands } from "./beacon-cli/server.js";

await runProgram({
  commands: [
    ...courseCommands,
    slugCommand,
    ...statusCommands,
    ...inboxCommands,
    ...serverCommands,
  ],
  metadata: {
    name: "beacon",
    brief: message`AI-guided learning companion.`,
  },
});
