import { defineRule } from "@oxlint/plugins";
import { elementName } from "../utils/jsx.js";

const ENTER = /⏎|\bEnter\b/u;
const DONT_KNOW = "I don't know yet";

function message(call) {
  const [first] = call.arguments;

  if (first?.type === "Literal") {
    return first.value;
  }

  const property =
    first?.type === "ObjectExpression"
      ? first.properties.find((entry) => entry.key?.name === "message")
      : null;

  return property?.value.type === "Literal" ? property.value.value : null;
}

export default defineRule({
  createOnce(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "t" &&
          message(node) === DONT_KNOW
        ) {
          context.report({ messageId: "actions", node });
        }
      },
      JSXElement(node) {
        if (
          elementName(node.openingElement) === "ShortcutKbd" &&
          ENTER.test(context.sourceCode.getText(node))
        ) {
          context.report({ messageId: "actions", node: node.openingElement });
        }
      },
    };
  },

  meta: {
    docs: { description: "A question's actions are drawn by `QuestionActions`." },
    messages: {
      actions:
        "A question's actions are `QuestionActions` (`@zoonk/learn/question-actions`): it draws \"I don't know yet\", the main action and its ⏎ the same way on every question.",
    },
    schema: [],
    type: "problem",
  },
});
