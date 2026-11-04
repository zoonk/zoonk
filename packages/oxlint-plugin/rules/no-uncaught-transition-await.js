import { defineRule } from "@oxlint/plugins";

const FUNCTIONS = new Set(["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"]);
const TRANSITION_HOOK = /^use\w*Transition$/u;

function isTransitionStart(callee, starters) {
  if (callee.type === "Identifier") {
    return callee.name === "startTransition" || starters.has(callee.name);
  }

  return (
    callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "startTransition"
  );
}

function getMethod(call) {
  return call.callee.type === "MemberExpression" && call.callee.property.type === "Identifier"
    ? call.callee.property.name
    : null;
}

function findLocalAsyncFunction({ callee, sourceCode }) {
  if (callee.type !== "Identifier") {
    return null;
  }

  for (let scope = sourceCode.getScope(callee); scope; scope = scope.upper) {
    const variable = scope.set.get(callee.name);

    if (variable) {
      const definition = variable.defs[0]?.node;
      const fn = definition?.type === "VariableDeclarator" ? definition.init : definition;
      return fn && FUNCTIONS.has(fn.type) && fn.async ? fn : null;
    }
  }

  return null;
}

function getChildren(node) {
  return Object.entries(node).flatMap(([key, value]) => {
    if (key === "parent" || !value || typeof value !== "object") {
      return [];
    }

    return (Array.isArray(value) ? value : [value]).filter(
      (child) => child && typeof child.type === "string",
    );
  });
}

/**
 * `safeAsync(...)`, `.catch(...)`, `.then(onFulfilled, onRejected)` and an async function in this
 * file whose own awaits all settle don't reject.
 */
function settles(node, scan) {
  if (node?.type !== "CallExpression") {
    return false;
  }

  const method = getMethod(node);

  if (method === "finally") {
    return settles(node.callee.object, scan);
  }

  if (
    (node.callee.type === "Identifier" && node.callee.name === "safeAsync") ||
    method === "catch" ||
    (method === "then" && node.arguments.length > 1)
  ) {
    return true;
  }

  const local = findLocalAsyncFunction({ callee: node.callee, sourceCode: scan.sourceCode });

  if (!local) {
    return false;
  }

  // A function awaiting itself settles when the rest of it does.
  if (scan.visiting.has(local)) {
    return true;
  }

  scan.visiting.add(local);
  const uncaught = findUncaughtAwaits(local.body, { caught: false, scan });
  scan.visiting.delete(local);
  return uncaught.length === 0;
}

function findUncaughtAwaits(node, { caught, scan }) {
  if (FUNCTIONS.has(node.type)) {
    return [];
  }

  if (node.type === "TryStatement") {
    return [
      ...findUncaughtAwaits(node.block, { caught: caught || Boolean(node.handler), scan }),
      ...(node.handler ? findUncaughtAwaits(node.handler, { caught, scan }) : []),
      ...(node.finalizer ? findUncaughtAwaits(node.finalizer, { caught, scan }) : []),
    ];
  }

  const own =
    node.type === "AwaitExpression" && !caught && !settles(node.argument, scan) ? [node] : [];

  return [
    ...own,
    ...getChildren(node).flatMap((child) => findUncaughtAwaits(child, { caught, scan })),
  ];
}

export default defineRule({
  createOnce(context) {
    let starters;

    return {
      before() {
        starters = new Set();
      },

      VariableDeclarator(node) {
        const start = node.id.type === "ArrayPattern" ? node.id.elements[1] : null;

        if (
          start?.type === "Identifier" &&
          node.init?.type === "CallExpression" &&
          node.init.callee.type === "Identifier" &&
          TRANSITION_HOOK.test(node.init.callee.name)
        ) {
          starters.add(start.name);
        }
      },

      CallExpression(node) {
        const isActionState =
          node.callee.type === "Identifier" && node.callee.name === "useActionState";

        if (!isActionState && !isTransitionStart(node.callee, starters)) {
          return;
        }

        const [callback] = node.arguments;

        if (!callback || !FUNCTIONS.has(callback.type) || !callback.async) {
          return;
        }

        const scan = { sourceCode: context.sourceCode, visiting: new Set() };

        for (const uncaught of findUncaughtAwaits(callback.body, { caught: false, scan })) {
          context.report({ messageId: "uncaughtTransitionAwait", node: uncaught });
        }
      },
    };
  },

  meta: {
    docs: {
      description:
        "Require every await inside an async transition or action state to handle its rejection",
    },
    messages: {
      uncaughtTransitionAwait:
        "React sends a rejection inside a transition to the nearest error boundary, so a Server Action that fails or can't reach the server replaces the screen with its error page. Handle it here (safeAsync, .catch or try/catch) and show the screen's own failure.",
    },
    schema: [],
    type: "problem",
  },
});
