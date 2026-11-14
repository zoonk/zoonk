import { defineRule } from "@oxlint/plugins";
import { elementName } from "../utils/jsx.js";

const BADGE = /(?:Badge|Chip)$/u;

function text(node) {
  if (node.type === "JSXText" || node.type === "Literal") {
    return node.value;
  }

  if (node.type === "JSXElement") {
    return elementName(node.openingElement).endsWith("Icon") ? "" : childrenText(node.children);
  }

  if (node.type === "JSXExpressionContainer") {
    return text(node.expression);
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

function childrenText(children) {
  const parts = children.map((child) => text(child));
  return parts.every((part) => typeof part === "string") ? parts.join("").trim() : null;
}

export default defineRule({
  createOnce(context) {
    return {
      JSXElement(node) {
        if (
          BADGE.test(elementName(node.openingElement)) &&
          childrenText(node.children) === "Plus"
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
