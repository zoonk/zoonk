import { defineRule } from "oxlint";

export default defineRule({
  createOnce(context) {
    return {
      JSXAttribute(node) {
        if (node.name.name !== "aria-label") {
          return;
        }

        if (node.value?.type === "Literal") {
          context.report({
            loc: node.value.loc,
            messageId: "noHardcodedAriaLabel",
            data: { value: node.value.value },
          });
        }
      },
    };
  },

  meta: {
    docs: {
      description: "Disallow hard-coded aria-label strings. Use t() for i18n translation instead.",
    },
    messages: {
      noHardcodedAriaLabel:
        'Hard-coded aria-label "{{value}}" must use t("{{value}}") for translation.',
    },
    schema: [],
    type: "problem",
  },
});
