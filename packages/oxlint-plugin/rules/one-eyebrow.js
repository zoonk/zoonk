import { defineRule } from "@oxlint/plugins";
import { elementName } from "../utils/jsx.js";

const LEGACY = new Set(["PageEyebrow", "DetailEyebrow"]);

export default defineRule({
  createOnce(context) {
    return {
      JSXOpeningElement(node) {
        if (LEGACY.has(elementName(node))) {
          context.report({ messageId: "eyebrow", node });
        }
      },
    };
  },
  meta: {
    docs: { description: "The line over a title is drawn by Eyebrow." },
    messages: {
      eyebrow:
        "Use Eyebrow (`@zoonk/learn/eyebrow`) for a line over a task or marketing title. Remove the line from an app page header.",
    },
    schema: [],
    type: "problem",
  },
});
