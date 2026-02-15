import { defineRule } from "@oxlint/plugins";

function isGetExtractedCall(node) {
  if (!node) {
    return false;
  }

  if (node.type === "AwaitExpression") {
    return isGetExtractedCall(node.argument);
  }

  if (node.type !== "CallExpression") {
    return false;
  }

  if (node.callee.type === "Identifier" && node.callee.name === "getExtracted") {
    return true;
  }

  return false;
}

function isUseExtractedCall(node) {
  if (!node) {
    return false;
  }

  if (node.type !== "CallExpression") {
    return false;
  }

  if (node.callee.type === "Identifier" && node.callee.name === "useExtracted") {
    return true;
  }

  return false;
}

function isTVariable(node) {
  return isGetExtractedCall(node) || isUseExtractedCall(node);
}

function checkObjectProperty(prop, tVariableNames, context) {
  if (prop.type !== "Property") {
    return;
  }

  // Check shorthand first: { t } - use key since it's the visible identifier
  if (prop.shorthand && prop.key.type === "Identifier" && tVariableNames.has(prop.key.name)) {
    context.report({
      data: { name: prop.key.name },
      loc: prop.key.loc,
      messageId: "noTFunctionAsArgument",
    });
    return;
  }

  // Non-shorthand: { translate: t }
  if (prop.value.type === "Identifier" && tVariableNames.has(prop.value.name)) {
    context.report({
      data: { name: prop.value.name },
      loc: prop.value.loc,
      messageId: "noTFunctionAsArgument",
    });
  }
}

export default defineRule({
  createOnce(context) {
    let tVariableNames;

    return {
      before() {
        tVariableNames = new Set();
      },

      VariableDeclarator(node) {
        if (!node.id || node.id.type !== "Identifier") {
          return;
        }

        if (isTVariable(node.init)) {
          tVariableNames.add(node.id.name);
        }
      },

      CallExpression(node) {
        if (tVariableNames.size === 0) {
          return;
        }

        // Get the callee name for checking if this is a direct t() call
        let calleeName = null;

        if (node.callee.type === "Identifier") {
          calleeName = node.callee.name;
        } else if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier"
        ) {
          calleeName = node.callee.object.name;
        }

        // Skip if this is calling t itself (t("key") or t.rich("key"))
        if (calleeName && tVariableNames.has(calleeName)) {
          return;
        }

        // Check if any argument is the t variable
        for (const arg of node.arguments) {
          if (arg.type === "Identifier" && tVariableNames.has(arg.name)) {
            context.report({
              data: { name: arg.name },
              loc: arg.loc,
              messageId: "noTFunctionAsArgument",
            });
          }

          // Also check object properties: someHelper({ translate: t }) or { t }
          if (arg.type === "ObjectExpression") {
            for (const prop of arg.properties) {
              checkObjectProperty(prop, tVariableNames, context);
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
