import { defineRule } from "oxlint";

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

function isStringLiteral(node) {
  if (!node) {
    return false;
  }

  // String literal
  if (node.type === "Literal" && typeof node.value === "string") {
    return true;
  }

  return false;
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

        // Get the callee name
        let calleeName = null;

        // Direct call: t("key")
        if (node.callee.type === "Identifier") {
          calleeName = node.callee.name;
        }

        // Method call: t.rich("key"), t.raw("key"), t.markup("key")
        if (node.callee.type === "MemberExpression" && node.callee.object.type === "Identifier") {
          calleeName = node.callee.object.name;
        }

        // Skip if not a t function call
        if (!calleeName || !tVariableNames.has(calleeName)) {
          return;
        }

        const firstArg = node.arguments[0];

        // No arguments - skip (invalid call anyway)
        if (!firstArg) {
          return;
        }

        // Check if first argument is a string literal
        if (!isStringLiteral(firstArg)) {
          context.report({
            loc: firstArg.loc,
            messageId: "noDynamicKey",
          });
        }
      },
    };
  },

  meta: {
    docs: {
      description:
        "Disallow dynamic keys (variables, expressions, template literals) as the first argument to the t() translation function",
    },
    messages: {
      noDynamicKey:
        'Translation key must be a string literal. Dynamic keys like t(variable) or t(`template`) break i18n extraction. Use t("String literal") instead.',
    },
    schema: [],
    type: "problem",
  },
});
