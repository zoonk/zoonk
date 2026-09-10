import { defineRule } from "@oxlint/plugins";
import { isTranslationIdentifier } from "../utils/translation-bindings.js";

function checkObjectProperty(prop, context) {
  if (prop.type !== "Property") {
    return;
  }

  if (isTranslationIdentifier({ node: prop.value, sourceCode: context.sourceCode })) {
    context.report({
      data: { name: prop.value.name },
      loc: prop.value.loc,
      messageId: "noTFunctionAsArgument",
    });
  }
}

export default defineRule({
  createOnce(context) {
    return {
      CallExpression(node) {
        const callee = node.callee.type === "MemberExpression" ? node.callee.object : node.callee;

        // Skip if this is calling t itself (t("key") or t.rich("key"))
        if (isTranslationIdentifier({ node: callee, sourceCode: context.sourceCode })) {
          return;
        }

        // Check if any argument is the t variable
        for (const arg of node.arguments) {
          if (isTranslationIdentifier({ node: arg, sourceCode: context.sourceCode })) {
            context.report({
              data: { name: arg.name },
              loc: arg.loc,
              messageId: "noTFunctionAsArgument",
            });
          }

          // Also check object properties: someHelper({ translate: t }) or { t }
          if (arg.type === "ObjectExpression") {
            for (const prop of arg.properties) {
              checkObjectProperty(prop, context);
            }
          }
        }
      },
    };
  },

  meta: {
    docs: {
      description:
        "Disallow passing the t function (from getExtracted/useExtracted) as an argument to other functions, which breaks i18n extraction",
    },
    messages: {
      noTFunctionAsArgument:
        "Do not pass '{{name}}' as a function argument. This breaks i18n extraction. Instead, create a function that calls getExtracted() or useExtracted() internally.",
    },
    schema: [],
    type: "problem",
  },
});
