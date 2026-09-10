import { defineRule } from "@oxlint/plugins";
import { getPromiseAllTranslationBindings } from "../utils/translation-bindings.js";

const PROMISE_METHODS = new Set(["all", "allSettled", "race", "any"]);

function containsGetExtractedCall(node, supportedCalls) {
  if (!node) {
    return false;
  }

  if (node.type === "CallExpression") {
    if (node.callee.type === "Identifier" && node.callee.name === "getExtracted") {
      return !supportedCalls.has(node);
    }

    return (
      node.arguments.some((arg) => containsGetExtractedCall(arg, supportedCalls)) ||
      containsGetExtractedCall(node.callee, supportedCalls)
    );
  }

  if (
    node.type === "AwaitExpression" ||
    node.type === "SpreadElement" ||
    node.type === "ReturnStatement"
  ) {
    return containsGetExtractedCall(node.argument, supportedCalls);
  }

  if (node.type === "ArrayExpression") {
    return node.elements.some((element) => containsGetExtractedCall(element, supportedCalls));
  }

  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
    return containsGetExtractedCall(node.body, supportedCalls);
  }

  if (node.type === "BlockStatement") {
    return node.body.some((statement) => containsGetExtractedCall(statement, supportedCalls));
  }

  if (node.type === "ExpressionStatement" || node.type === "ChainExpression") {
    return containsGetExtractedCall(node.expression, supportedCalls);
  }

  if (node.type === "VariableDeclaration") {
    return node.declarations.some((decl) => containsGetExtractedCall(decl, supportedCalls));
  }

  if (node.type === "VariableDeclarator") {
    return containsGetExtractedCall(node.init, supportedCalls);
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
    let supportedCalls;

    return {
      before() {
        supportedCalls = new WeakSet();
      },

      VariableDeclarator(node) {
        for (const { call } of getPromiseAllTranslationBindings({
          node,
          sourceCode: context.sourceCode,
        })) {
          supportedCalls.add(call);
        }
      },

      CallExpression(node) {
        if (!isPromiseCombinator(node)) {
          return;
        }

        const methodName = node.callee.property.name;

        for (const arg of node.arguments) {
          if (containsGetExtractedCall(arg, supportedCalls)) {
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
        "Disallow getExtracted() in Promise combinators unless next-intl can extract its translator binding",
    },
    messages: {
      noGetExtractedInPromise:
        "next-intl cannot extract this getExtracted() usage inside Promise.{{method}}(). Await it directly or use const [t, data] = await Promise.all([getExtracted(), fetchData()]) with an inline array without spreads and an identifier binding for each translator.",
    },
    schema: [],
    type: "problem",
  },
});
