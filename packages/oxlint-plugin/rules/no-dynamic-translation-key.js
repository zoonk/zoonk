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

function getStaticPropertyName(property) {
  if (!property || property.computed) {
    return null;
  }

  if (property.key.type === "Identifier") {
    return property.key.name;
  }

  if (property.key.type === "Literal" && typeof property.key.value === "string") {
    return property.key.value;
  }

  return null;
}

function isStaticMessageDescriptor(node) {
  if (!node || node.type !== "ObjectExpression") {
    return false;
  }

  let hasStaticMessage = false;

  for (const property of node.properties) {
    if (property.type !== "Property") {
      return false;
    }

    const propertyName = getStaticPropertyName(property);

    if (!propertyName) {
      return false;
    }

    if (propertyName === "message") {
      hasStaticMessage = isStringLiteral(property.value);
    }

    if (
      (propertyName === "id" || propertyName === "description") &&
      !isStringLiteral(property.value)
    ) {
      return false;
    }
  }

  return hasStaticMessage;
}

function isStaticTranslationArgument(node) {
  return isStringLiteral(node) || isStaticMessageDescriptor(node);
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

        // Check if first argument is a string literal or a static next-intl
        // message descriptor with translator context.
        if (!isStaticTranslationArgument(firstArg)) {
          context.report({ loc: firstArg.loc, messageId: "noDynamicKey" });
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
        'Translation key must be a string literal or static message descriptor. Dynamic keys like t(variable) or t(`template`) break i18n extraction. Use t("String literal") or t({message: "String literal"}) instead.',
    },
    schema: [],
    type: "problem",
  },
});
