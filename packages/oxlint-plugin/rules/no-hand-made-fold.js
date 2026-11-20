import { defineRule } from "@oxlint/plugins";
import { elementName } from "../utils/jsx.js";

const HEIGHT = "--collapsible-panel-height";
const FOLD_GLYPH = /^Chevron(?:Down|Right)Icon$/u;

function inTrigger(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      parent.type === "JSXElement" &&
      elementName(parent.openingElement) === "CollapsibleTrigger"
    ) {
      return true;
    }
  }

  return false;
}

export default defineRule({
  createOnce(context) {
    return {
      JSXElement(node) {
        if (FOLD_GLYPH.test(elementName(node.openingElement)) && inTrigger(node)) {
          context.report({ messageId: "fold", node: node.openingElement });
        }
      },
      Literal(node) {
        if (typeof node.value === "string" && node.value.includes(HEIGHT)) {
          context.report({ messageId: "fold", node });
        }
      },
      TemplateElement(node) {
        if (node.value.cooked?.includes(HEIGHT)) {
          context.report({ messageId: "fold", node });
        }
      },
    };
  },

  meta: {
    docs: { description: "A fold is drawn by `CollapsibleContent` and `FoldChevron`." },
    messages: {
      fold: "`CollapsibleContent` already animates the fold, and `FoldChevron` draws its chevron (`@zoonk/ui/components/collapsible`). Pass only what differs.",
    },
    schema: [],
    type: "problem",
  },
});
