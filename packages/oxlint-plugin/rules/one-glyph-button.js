import { defineRule } from "@oxlint/plugins";
import { classSource, countChildren, elementName, elementProp } from "../utils/jsx.js";

const GLYPH = /(?:Icon|Kbd|Spinner)$/u;
/** A picker's down chevron marks it as one, the way a select's does. */
const PICKER = /^Chevrons?(?:Down|UpDown)Icon$/u;
const ARROW = /^(?:Arrow|Move)(?:Left|Right)Icon$/u;
/** A list row is a link or a button too, and keeps its leading mark beside its chevron. */
const BUTTON = /^button$|(?<!Row)Button$|^(?:TaskMain|Enter)Link$/u;
/** Anything a tap moves on from, rows included: their direction is a chevron too. */
const CONTROL = /^(?:a|button)$|(?:Link|Button)$/u;
/** A control drawn as a field (the search box) keeps its icon and its keycap. */
const FIELD = /\b(?:ring|border)-input\b/u;

function isButton(context, opening) {
  const rendered = elementProp(opening, "render");

  return (
    BUTTON.test(elementName(opening)) ||
    (rendered !== null && BUTTON.test(elementName(rendered.openingElement))) ||
    classSource(context, opening).includes("buttonVariants(")
  );
}

/** Inside a control, given to one as a prop (`icon={…}`), or a piece's default `icon`. */
function onControl(context, node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "Property" && parent.key?.name === "icon") {
      return true;
    }

    if (
      parent.type === "JSXElement" &&
      (CONTROL.test(elementName(parent.openingElement)) || isButton(context, parent.openingElement))
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
        const { openingElement } = node;
        const name = elementName(openingElement);

        if (ARROW.test(name) && onControl(context, node)) {
          context.report({ data: { name }, messageId: "chevron", node: openingElement });
          return;
        }

        if (
          !isButton(context, openingElement) ||
          FIELD.test(classSource(context, openingElement))
        ) {
          return;
        }

        const glyphs = countChildren(node.children, (child) => {
          const glyph = elementName(child.openingElement);
          return GLYPH.test(glyph) && !PICKER.test(glyph);
        });

        if (glyphs > 1) {
          context.report({ messageId: "oneGlyph", node: openingElement });
        }
      },
    };
  },

  meta: {
    docs: {
      description: "A button shows its label and at most one glyph, and a direction is a chevron.",
    },
    messages: {
      chevron:
        "{{name}}: going forward or back is a chevron (ChevronRightIcon, ChevronLeftIcon), never an arrow.",
      oneGlyph:
        "This button draws more than one glyph. It shows its label and at most one: a main action Enter presses shows only its ⏎ hint, and its spinner takes the hint's place while it works.",
    },
    schema: [],
    type: "problem",
  },
});
