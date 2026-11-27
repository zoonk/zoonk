import { defineRule } from "@oxlint/plugins";
import {
  HELD_PRESS_INPUT_TYPE,
  HELD_PRESS_ROLES,
  HELD_PRESS_TAG,
} from "../../ui/src/lib/held-press-controls.ts";

const PRESS_HANDLERS = new Set(["onClick", "onPointerDown", "onMouseDown", "onPointerUp"]);

function attribute(opening, name) {
  return opening.attributes.find((attr) => attr.type === "JSXAttribute" && attr.name.name === name);
}

function literalAttribute(opening, name) {
  const value = attribute(opening, name)?.value;

  const literal = value?.type === "JSXExpressionContainer" ? value.expression : value;
  return literal?.type === "Literal" && typeof literal.value === "string" ? literal.value : "";
}

function isControl(opening) {
  const tag = opening.name.name;

  if (tag === "a" && attribute(opening, "href")) {
    return false;
  }

  return (
    tag === HELD_PRESS_TAG ||
    (tag === "input" &&
      literalAttribute(opening, "type").toLowerCase() === HELD_PRESS_INPUT_TYPE) ||
    HELD_PRESS_ROLES.includes(literalAttribute(opening, "role"))
  );
}

export default defineRule({
  createOnce(context) {
    return {
      JSXOpeningElement(node) {
        if (
          node.name.type !== "JSXIdentifier" ||
          !/^[a-z]/u.test(node.name.name) ||
          isControl(node)
        ) {
          return;
        }

        const handler = node.attributes.find(
          (attr) => attr.type === "JSXAttribute" && PRESS_HANDLERS.has(attr.name.name),
        );

        if (handler) {
          context.report({ messageId: "control", node: handler });
        }
      },
    };
  },

  meta: {
    docs: { description: "Press handlers belong on controls recognized before hydration." },
    messages: {
      control:
        "Put this press handler on a button, a submit input, or an element with a supported control role so an early press is held.",
    },
    schema: [],
    type: "problem",
  },
});
