import { defineRule } from "@oxlint/plugins";

const FUNCTIONS = new Set(["ArrowFunctionExpression", "FunctionDeclaration", "FunctionExpression"]);

const TRANSPARENT = new Set([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
]);

const TRANSITION_HOOK = /^use\w*Transition$/u;
const HOOK = /^use[A-Z]/u;

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

/** Only a declaration in this file: a parameter's or an import's value isn't known here. */
function findDeclaration({ node, sourceCode }) {
  for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
    const definition = scope.set.get(node.name)?.defs[0];

    if (definition) {
      return ["FunctionName", "Variable"].includes(definition.type) ? definition.node : null;
    }
  }

  return null;
}

/** A built-in such as `Boolean`, declared nowhere in the file. */
function isGlobal(node, scan) {
  if (node?.type !== "Identifier") {
    return false;
  }

  for (let scope = scan.sourceCode.getScope(node); scope; scope = scope.upper) {
    if (scope.set.get(node.name)?.defs.length) {
      return false;
    }
  }

  return true;
}

function getLocalFunction(node, scan) {
  if (FUNCTIONS.has(node?.type)) {
    return node;
  }

  if (node?.type !== "Identifier") {
    return null;
  }

  const definition = findDeclaration({ node, sourceCode: scan.sourceCode });
  const fn = definition?.type === "VariableDeclarator" ? definition.init : definition;
  return FUNCTIONS.has(fn?.type) ? fn : null;
}

/** A setter from a React hook (`const [, setX] = useState()`) runs at once and returns nothing. */
function isHookSetter(callee, scan) {
  if (callee.type !== "Identifier") {
    return false;
  }

  const definition = findDeclaration({ node: callee, sourceCode: scan.sourceCode });

  return (
    definition?.type === "VariableDeclarator" &&
    definition.id.type === "ArrayPattern" &&
    definition.init?.type === "CallExpression" &&
    definition.init.callee.type === "Identifier" &&
    HOOK.test(definition.init.callee.name)
  );
}

function localFunctionSettles(node, scan) {
  const fn = getLocalFunction(node, scan);
  return fn !== null && functionSettles(fn, scan);
}

/** A built-in handler (`.then(Boolean, …)`) runs at once. */
function handlerSettles(node, scan) {
  return isGlobal(node, scan) || localFunctionSettles(node, scan);
}

/**
 * `safeAsync(...)`, `.catch(handler)`, `.then(onFulfilled, onRejected)` and `.finally(handler)`
 * settle when their handlers do; so does a call to a function in this file that settles.
 */
function callSettles(call, scan) {
  const method = getMethod(call);
  const [first, second] = call.arguments;

  if (method === "finally") {
    return callSettles(call.callee.object, scan) && handlerSettles(first, scan);
  }

  if (method === "catch") {
    return handlerSettles(first, scan);
  }

  if (method === "then") {
    return call.arguments.length > 1 && handlerSettles(first, scan) && handlerSettles(second, scan);
  }

  if (
    (call.callee.type === "Identifier" && call.callee.name === "safeAsync") ||
    isHookSetter(call.callee, scan)
  ) {
    return true;
  }

  return localFunctionSettles(call.callee, scan);
}

/**
 * Whether an awaited or returned value can't be a promise that rejects. A returned built-in call
 * (`return Boolean(data)`) is a value; an awaited one (`await fetch(url)`) is still checked.
 */
function valueSettles(node, scan, { returned = false } = {}) {
  if (!node) {
    return true;
  }

  const settles = (child) => valueSettles(child, scan, { returned });

  if (TRANSPARENT.has(node.type)) {
    return settles(node.expression);
  }

  if (node.type === "ConditionalExpression") {
    return settles(node.consequent) && settles(node.alternate);
  }

  if (node.type === "LogicalExpression") {
    return settles(node.left) && settles(node.right);
  }

  if (node.type === "SequenceExpression") {
    return settles(node.expressions.at(-1));
  }

  return (
    node.type !== "CallExpression" ||
    (returned && isGlobal(node.callee, scan)) ||
    callSettles(node, scan)
  );
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

/** Awaits and throws a `catch` doesn't stop, and returned promises, which no `catch` stops. */
function findRejections(node, { caught, scan }) {
  if (FUNCTIONS.has(node.type)) {
    return [];
  }

  if (node.type === "TryStatement") {
    return [
      ...findRejections(node.block, { caught: caught || Boolean(node.handler), scan }),
      ...(node.handler ? findRejections(node.handler, { caught, scan }) : []),
      ...(node.finalizer ? findRejections(node.finalizer, { caught, scan }) : []),
    ];
  }

  const rejects =
    (node.type === "AwaitExpression" && !caught && !valueSettles(node.argument, scan)) ||
    (node.type === "ThrowStatement" && !caught) ||
    (node.type === "ReturnStatement" && !valueSettles(node.argument, scan, { returned: true }));

  return [
    ...(rejects ? [node] : []),
    ...getChildren(node).flatMap((child) => findRejections(child, { caught, scan })),
  ];
}

function findFunctionRejections(fn, scan) {
  const returned =
    fn.body.type === "BlockStatement" || valueSettles(fn.body, scan, { returned: true })
      ? []
      : [fn.body];

  return [...returned, ...findRejections(fn.body, { caught: false, scan })];
}

function functionSettles(fn, scan) {
  // A function that calls itself settles when the rest of it does.
  if (scan.visiting.has(fn)) {
    return true;
  }

  scan.visiting.add(fn);
  const settles = findFunctionRejections(fn, scan).length === 0;
  scan.visiting.delete(fn);
  return settles;
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

        const scan = { sourceCode: context.sourceCode, visiting: new Set() };
        const callback = getLocalFunction(node.arguments[0], scan);

        if (!callback?.async) {
          return;
        }

        scan.visiting.add(callback);

        for (const rejection of findFunctionRejections(callback, scan)) {
          context.report({ messageId: "uncaughtTransitionAwait", node: rejection });
        }
      },
    };
  },

  meta: {
    docs: {
      description:
        "Require an async transition or action state to settle every promise it awaits or returns",
    },
    messages: {
      uncaughtTransitionAwait:
        "React sends a rejection inside a transition to the nearest error boundary, so a Server Action that fails or can't reach the server replaces the screen with its error page. Handle it here (safeAsync, .catch or try/catch) and show the screen's own failure.",
    },
    schema: [],
    type: "problem",
  },
});
