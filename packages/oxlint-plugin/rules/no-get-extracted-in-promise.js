import { defineRule } from "@oxlint/plugins";

const PROMISE_METHODS = new Set(["all", "allSettled", "race", "any"]);

function containsGetExtractedCall(node) {
  if (!node) {
    return false;
  }

  if (node.type === "CallExpression") {
    if (node.callee.type === "Identifier" && node.callee.name === "getExtracted") {
      return true;
    }

    return (
      node.arguments.some((arg) => containsGetExtractedCall(arg)) ||
      containsGetExtractedCall(node.callee)
    );
  }

  if (node.type === "AwaitExpression") {
    return containsGetExtractedCall(node.argument);
  }

  if (node.type === "ArrayExpression") {
    return node.elements.some((element) => containsGetExtractedCall(element));
  }

  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
    return containsGetExtractedCall(node.body);
  }

  if (node.type === "BlockStatement") {
    return node.body.some((statement) => containsGetExtractedCall(statement));
  }

  if (node.type === "ReturnStatement" || node.type === "ExpressionStatement") {
    return containsGetExtractedCall(node.expression);
  }

  if (node.type === "VariableDeclaration") {
    return node.declarations.some((decl) => containsGetExtractedCall(decl));
  }

  if (node.type === "VariableDeclarator") {
    return containsGetExtractedCall(node.init);
  }

  return false;
}

function isPromiseCombinator(node) {
  if (node.callee.type !== "MemberExpression") {
    return false;
  }

  const { object, property } = node.callee;

  return (
    object.type === "Identifier" && object.name === "Promise" && PROMISE_METHODS.has(property.name)
  );
}

export default defineRule({
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isPromiseCombinator(node)) {
          return;
        }

        const methodName = node.callee.property.name;

        for (const arg of node.arguments) {
          if (containsGetExtractedCall(arg)) {
            context.report({
              loc: arg.loc,
              messageId: "noGetExtractedInPromise",
              data: { method: methodName },
            });
          }
        }
      },
    };
  },

  meta: {
    docs: {
      description:
        "Disallow getExtracted() inside Promise.all, Promise.allSettled, Promise.race, or Promise.any",
    },
    messages: {
      noGetExtractedInPromise: "getExtracted() cannot be used inside Promise.{{method}}().",
    },
    schema: [],
    type: "problem",
  },
});
