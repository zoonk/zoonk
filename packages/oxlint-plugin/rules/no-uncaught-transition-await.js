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

/** React's own hooks whose second element runs at once and returns nothing. */
const REACT_DISPATCH_HOOKS = new Set([
  "useActionState",
  "useOptimistic",
  "useReducer",
  "useState",
  "useTransition",
]);

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

function findDefinition({ node, sourceCode }) {
  for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
    const definition = scope.set.get(node.name)?.defs[0];

    if (definition) {
      return definition;
    }
  }

  return null;
}

/** Only a declaration in this file: a parameter's or an import's value isn't known here. */
function findDeclaration({ node, sourceCode }) {
  const definition = findDefinition({ node, sourceCode });
  return ["FunctionName", "Variable"].includes(definition?.type) ? definition.node : null;
}

/** A built-in such as `Boolean`, declared nowhere in the file. */
function isGlobal(node, scan) {
  return (
    node?.type === "Identifier" && findDefinition({ node, sourceCode: scan.sourceCode }) === null
  );
}

/** An import, or a `const` bound from one (`saveAction.bind(null, id)`). */
function isImportedFunction(node, scan) {
  if (node?.type !== "Identifier") {
    return false;
  }

  const definition = findDefinition({ node, sourceCode: scan.sourceCode });

  if (definition?.type === "ImportBinding") {
    return true;
  }

  const init = definition?.type === "Variable" ? definition.node.init : null;

  return (
    init?.type === "CallExpression" &&
    getMethod(init) === "bind" &&
    isImportedFunction(init.callee.object, scan)
  );
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

function isReactDispatch(callee, scan) {
  if (callee.type !== "Identifier") {
    return false;
  }

  const definition = findDeclaration({ node: callee, sourceCode: scan.sourceCode });

  return (
    definition?.type === "VariableDeclarator" &&
    definition.id.type === "ArrayPattern" &&
    definition.id.elements[1]?.type === "Identifier" &&
    definition.id.elements[1].name === callee.name &&
    definition.init?.type === "CallExpression" &&
    definition.init.callee.type === "Identifier" &&
    REACT_DISPATCH_HOOKS.has(definition.init.callee.name)
  );
}

function localFunctionSettles(node, scan) {
  const fn = getLocalFunction(node, scan);
  return fn !== null && functionSettles(fn, scan);
}

/**
 * A built-in handler (`.then(Boolean, …)`) runs at once; any other handler's returned promise
 * settles the chain, so it's checked as one.
 */
function handlerSettles(node, scan) {
  return isGlobal(node, scan) || localFunctionSettles(node, { ...scan, returnsPromise: true });
}

/**
 * `safeAsync(...)`, `.catch(handler)`, `.then(onFulfilled, onRejected)` and `.finally(handler)`
 * settle when their handlers do; so does a call to a function in this file that settles.
 */
function callSettles(call, scan) {
  const method = getMethod(call);
  const [first, second] = call.arguments;

  if (method === "finally") {
    return valueSettles(call.callee.object, scan) && handlerSettles(first, scan);
  }

  if (method === "catch") {
    return handlerSettles(first, scan);
  }

  if (method === "then") {
    return call.arguments.length > 1 && handlerSettles(first, scan) && handlerSettles(second, scan);
  }

  if (
    (call.callee.type === "Identifier" && call.callee.name === "safeAsync") ||
    isReactDispatch(call.callee, scan)
  ) {
    return true;
  }

  return localFunctionSettles(call.callee, scan);
}

/**
 * A function nothing awaits makes a promise only from an import (a Server Action, bound or not), a
 * promise method or a function in this file; anything else it returns (`router.push(url)`) is a value.
 */
function mayReturnPromise(call, scan) {
  return (
    scan.returnsPromise ||
    ["catch", "finally", "then"].includes(getMethod(call)) ||
    isImportedFunction(call.callee, scan) ||
    getLocalFunction(call.callee, scan) !== null
  );
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

  if (node.type === "Identifier") {
    return storedValueSettles(node, scan, { returned });
  }

  if (node.type === "NewExpression" && node.callee.type === "Identifier") {
    return node.callee.name !== "Promise" || executorSettles(node.arguments[0], scan);
  }

  return (
    node.type !== "CallExpression" ||
    (returned && (isGlobal(node.callee, scan) || !mayReturnPromise(node, scan))) ||
    callSettles(node, scan)
  );
}

/**
 * A promise made by hand settles when its executor takes only `resolve` and never throws. Without
 * types, `resolve(aRejectedPromise)` still passes.
 */
function executorSettles(executor, scan) {
  if (!FUNCTIONS.has(executor?.type)) {
    return false;
  }

  const onlyResolve = executor.params.every((param) => param.type === "Identifier");

  const throws = findRejections(executor.body, { caught: false, scan }).some(
    (rejection) => rejection.type === "ThrowStatement",
  );

  return onlyResolve && executor.params.length < 2 && !throws;
}

/** A promise kept in a `const` (`const pending = save()`) is checked where it was made. */
function storedValueSettles(node, scan, { returned }) {
  const definition = findDeclaration({ node, sourceCode: scan.sourceCode });

  if (definition?.type !== "VariableDeclarator" || definition.id.type !== "Identifier") {
    return true;
  }

  if (scan.visiting.has(definition)) {
    return true;
  }

  scan.visiting.add(definition);
  const settles = valueSettles(definition.init, scan, { returned });
  scan.visiting.delete(definition);
  return settles;
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

/** A helper's return reaches its caller, so it's a promise when the caller's is; an async one's always is. */
function findFunctionRejections(
  fn,
  outerScan,
  { returnsPromise = outerScan.returnsPromise || fn.async } = {},
) {
  const scan = { ...outerScan, returnsPromise };

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

const FORM_ACTION_PROPS = new Set(["action", "formAction"]);

export default defineRule({
  createOnce(context) {
    let starters;

    /** React awaits what an action state's function returns, async or not. */
    function checkCallback(callback, { isActionState = false } = {}) {
      const scan = { sourceCode: context.sourceCode, visiting: new Set([callback]) };
      const returnsPromise = callback.async || isActionState;

      for (const rejection of findFunctionRejections(callback, scan, { returnsPromise })) {
        context.report({ messageId: "uncaughtTransitionAwait", node: rejection });
      }
    }

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

        const callback = getLocalFunction(node.arguments[0], { sourceCode: context.sourceCode });

        if (callback) {
          checkCallback(callback, { isActionState });
        } else if (isActionState) {
          context.report({
            messageId: "unknownActionStateCallback",
            node: node.arguments[0] ?? node,
          });
        }
      },

      JSXAttribute(node) {
        const callback =
          FORM_ACTION_PROPS.has(node.name.name) &&
          getLocalFunction(node.value?.expression, { sourceCode: context.sourceCode });

        if (callback) {
          checkCallback(callback);
        }
      },
    };
  },

  meta: {
    docs: {
      description:
        "Require a transition, form action or action state to settle every promise it awaits or returns",
    },
    messages: {
      uncaughtTransitionAwait:
        "React sends a rejection inside a transition to the nearest error boundary, so a Server Action that fails or can't reach the server replaces the screen with its error page. Handle it here (safeAsync, .catch or try/catch) and show the screen's own failure.",
      unknownActionStateCallback:
        "React sends a rejection from useActionState's action to the nearest error boundary, so a Server Action handed to it directly replaces the screen with its error page when it fails or can't reach the server. Pass a function declared in this file that catches it (safeAsync, .catch or try/catch) and returns the screen's own failure.",
    },
    schema: [],
    type: "problem",
  },
});
