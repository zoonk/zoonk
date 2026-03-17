import { defineRule } from "@oxlint/plugins";

function isFilterCall(node) {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.property.name === "filter"
  );
}

function isMapCall(node) {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.property.name === "map"
  );
}

export default defineRule({
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isFilterCall(node)) {
          return;
        }

        const mapCall = node.callee.object;

        if (!isMapCall(mapCall)) {
          return;
        }

        context.report({
          loc: node.loc,
          messageId: "preferFlatMap",
        });
      },
    };
  },

  meta: {
    docs: {
      description:
        "Prefer flatMap over map followed by filter. flatMap transforms and filters in a single pass, avoiding an intermediate array.",
    },
    messages: {
      preferFlatMap:
        "Use flatMap() instead of map().filter(). flatMap transforms and filters in one pass without creating an intermediate array.",
    },
    schema: [],
    type: "suggestion",
  },
});
