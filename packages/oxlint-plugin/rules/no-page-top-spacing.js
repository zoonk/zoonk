import { defineRule } from "@oxlint/plugins";
import { classSource, elementName } from "../utils/jsx.js";

const ROOTS = new Set(["Page", "DetailLayout", "SectionPage", "OnboardingPage", "PageTop"]);
const SPACING = /(?:^|[\s"'`])(?:[\w[\].-]+:)*-?(?:pt|py|mt)-/u;

function isFirstChild(node) {
  const parent = node.parent;

  return (
    parent?.type === "JSXElement" &&
    ROOTS.has(elementName(parent.openingElement)) &&
    parent.children.find((child) => child.type !== "JSXText" || child.value.trim() !== "") === node
  );
}

export default defineRule({
  createOnce(context) {
    return {
      JSXElement(node) {
        if (
          (ROOTS.has(elementName(node.openingElement)) || isFirstChild(node)) &&
          SPACING.test(classSource(context, node.openingElement))
        ) {
          context.report({ messageId: "spacing", node: node.openingElement });
        }
      },
    };
  },
  meta: {
    docs: { description: "The shared page top owns the space above a page's title." },
    messages: {
      spacing:
        "Remove this page's top spacing. PageTop (`@zoonk/ui/components/page-top`) owns the room above the title on every screen.",
    },
    schema: [],
    type: "problem",
  },
});
