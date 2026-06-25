import { object } from "@optique/core/constructs";
import { argument } from "@optique/core/primitives";
import { string } from "@optique/core/valueparser";
import { message } from "@optique/core/message";
import { defineCommand } from "@optique/discover";
import * as lib from "./lib.js";

export const slugCommand = defineCommand({
  path: ["slug"],
  parser: object({ topic: argument(string({ metavar: "TOPIC" })) }),
  metadata: { brief: message`Generate a lesson slug.` },
  handler({ topic }) {
    const slugPart = topic
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    console.log(`${lib.nowTimestamp()}-${slugPart}`);
  },
});
