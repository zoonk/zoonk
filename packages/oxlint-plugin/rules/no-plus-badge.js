import { defineRule } from "@oxlint/plugins";
import { elementName } from "../utils/jsx.js";

const BADGE = new Set(["Badge", "LabelChip", "PlusMark"]);

function text(node) {
  if (node.type === "JSXText") {
    return node.value.trim();
  }

  if (node.type === "JSXExpressionContainer") {
    return text(node.expression);
  }

  if (node.type === "Literal") {
    return node.value;
  }

  if (node.type === "CallExpression" && node.callee.name === "t") {
    const [first] = node.arguments;

    if (first?.type === "ObjectExpression") {
      return first.properties.find((property) => property.key?.name === "message")?.value?.value;
    }

    return first?.value;
  }

  return null;
}

export default defineRule({
  createOnce(context) {
    return {
      JSXElement(node) {
        const children = node.children.filter(
          (child) => child.type !== "JSXText" || child.value.trim() !== "",
        );

        if (
          BADGE.has(elementName(node.openingElement)) &&
          children.length === 1 &&
          text(children[0]) === "Plus"
        ) {
          context.report({ messageId: "badge", node: node.openingElement });
        }
      },
    };
  },
  meta: {
    docs: { description: "Paid features have no Plus badge." },
    messages: {
      badge:
        "Remove the Plus badge. A paid feature looks like any other; its subscription gate appears when the learner tries to use it.",
    },
    schema: [],
    type: "problem",
  },
});
