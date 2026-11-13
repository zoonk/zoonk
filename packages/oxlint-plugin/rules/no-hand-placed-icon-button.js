import { defineRule } from "@oxlint/plugins";
import { classSource, elementName, elementProp, isImportedName } from "../utils/jsx.js";

const CONTROL = /^Button$|(?:Link|Trigger)$/u;
const PULL = /(?:^|[\s"'`])(?:[a-z0-9-]+:)*-m[lrxse]-/u;

function sizeOf(opening) {
  const size = opening.attributes.find(
    (attr) => attr.type === "JSXAttribute" && attr.name.name === "size",
  );

  return size?.value?.type === "Literal" ? String(size.value.value) : null;
}

function onlyIcon(node) {
  const drawn = node.children.filter(
    (child) => child.type !== "JSXText" || child.value.trim() !== "",
  );

  const [child] = drawn;

  return (
    drawn.length === 1 &&
    child.type === "JSXElement" &&
    elementName(child.openingElement).endsWith("Icon")
  );
}

function iconButton(node) {
  const { openingElement } = node;
  const rendered = elementProp(openingElement, "render");

  const control =
    CONTROL.test(elementName(openingElement)) ||
    (rendered !== null && CONTROL.test(elementName(rendered.openingElement)));

  const size = sizeOf(openingElement) ?? (rendered ? sizeOf(rendered.openingElement) : null);
  return control && (size === null ? onlyIcon(node) : size.startsWith("icon"));
}

export default defineRule({
  createOnce(context) {
    return {
      Identifier(node) {
        if (node.name === "TASK_HEADER_ICON_CLASS" && !isImportedName(node)) {
          context.report({ messageId: "edge", node });
        }
      },
      JSXElement(node) {
        const rendered = elementProp(node.openingElement, "render");

        const classes =
          classSource(context, node.openingElement) +
          (rendered ? classSource(context, rendered.openingElement) : "");

        if (iconButton(node) && PULL.test(classes)) {
          context.report({ messageId: "edge", node: node.openingElement });
        }
      },
    };
  },

  meta: {
    docs: { description: "An icon button on a screen's edge is placed by `Button`'s `edge`." },
    messages: {
      edge: 'Put an icon button on a screen\'s edge with `edge="start"` or `edge="end"` on `Button` (`@zoonk/ui/components/button`), which lines its glyph up with the column. A hand-written margin drifts from every other screen\'s.',
    },
    schema: [],
    type: "problem",
  },
});
