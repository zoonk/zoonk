import { parseSync } from "oxc-parser";
import { type ChangedFile, type Flag } from "./diff-audit.mts";
import { type Rule, SOURCE } from "./rules/shared.mts";

/** next-intl's functions stay sequential, never inside `Promise.all` (root `AGENTS.md`). */
const SEQUENTIAL_CALLS = new Set([
  "getExtracted",
  "getFormatter",
  "getLocale",
  "getMessages",
  "getNow",
  "getTimeZone",
  "getTranslations",
]);

/** A transaction runs its statements one at a time on one connection, in the order they're written. */
const TRANSACTION_CLIENTS = new Set(["transaction", "tx"]);

const SAMPLE_LENGTH = 100;

const WATERFALL_RULE: Rule = {
  name: "Waterfall",
  question:
    "This await doesn't use the result of the one just before it, yet waits for it: each is a round trip the request pays in turn. Start independent work together (`Promise.all`), or let each component start its own read, unless the order is the point (say why).",
  role: "engineering",
};

type Node = { [key: string]: unknown; end: number; start: number; type: string };

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && "type" in value && "start" in value;
}

function children(node: Node): Node[] {
  return Object.values(node)
    .flatMap((value): unknown[] => (Array.isArray(value) ? value : [value]))
    .filter((value) => isNode(value));
}

function unwrap(node: unknown): unknown {
  return isNode(node) &&
    [
      "ParenthesizedExpression",
      "TSAsExpression",
      "TSNonNullExpression",
      "TSSatisfiesExpression",
    ].includes(node.type)
    ? unwrap(node.expression)
    : node;
}

function awaitedDeclaration(statement: unknown): { bound: Set<string>; awaited: Node } | null {
  if (
    !isNode(statement) ||
    statement.type !== "VariableDeclaration" ||
    !Array.isArray(statement.declarations)
  ) {
    return null;
  }

  const [declaration, ...rest] = statement.declarations.filter((value) => isNode(value));
  const init = unwrap(declaration?.init);

  if (!declaration || rest.length > 0 || !isNode(init) || init.type !== "AwaitExpression") {
    return null;
  }

  return isNode(init.argument)
    ? { awaited: init.argument, bound: names(isNode(declaration.id) ? declaration.id : null) }
    : null;
}

function names(node: Node | null): Set<string> {
  const found = new Set<string>();

  function visit(current: Node) {
    if (current.type === "Identifier" && typeof current.name === "string") {
      found.add(current.name);
    }

    for (const child of children(current)) {
      const isPropertyName =
        current.type === "MemberExpression" && !current.computed && child === current.property;

      if (!isPropertyName) {
        visit(child);
      }
    }
  }

  if (node) {
    visit(node);
  }

  return found;
}

function calleeName(awaited: Node): string | null {
  const callee =
    awaited.type === "CallExpression" && isNode(awaited.callee) ? awaited.callee : null;

  return callee?.type === "Identifier" && typeof callee.name === "string" ? callee.name : null;
}

function statementLists(root: unknown): Node[][] {
  const lists: Node[][] = [];

  function visit(node: Node) {
    if (
      Array.isArray(node.body) &&
      ["BlockStatement", "Program", "StaticBlock"].includes(node.type)
    ) {
      lists.push(node.body.filter((value) => isNode(value)));
    } else if (node.type === "SwitchCase" && Array.isArray(node.consequent)) {
      lists.push(node.consequent.filter((value) => isNode(value)));
    }

    for (const child of children(node)) {
      visit(child);
    }
  }

  if (isNode(root)) {
    visit(root);
  }

  return lists;
}

/**
 * Bare `await x;` steps are left out, since their order is usually the point (a write,
 * `navigation()`), and so are statements in a transaction.
 */
export function findWaterfalls(path: string, source: string): { offset: number; text: string }[] {
  const { errors, program } = parseSync(path, source);

  if (errors.length > 0) {
    return [];
  }

  return statementLists(program).flatMap((list) =>
    list.slice(1).flatMap((statement, index) => {
      const previous = awaitedDeclaration(list[index]);
      const current = awaitedDeclaration(statement);

      if (!previous || !current) {
        return [];
      }

      const uses = names(current.awaited);

      const sequential = [previous.awaited, current.awaited].some(
        (awaited) =>
          SEQUENTIAL_CALLS.has(calleeName(awaited) ?? "") ||
          [...names(awaited)].some((name) => TRANSACTION_CLIENTS.has(name)),
      );

      const dependent = [...previous.bound].some((name) => uses.has(name));

      return sequential || dependent
        ? []
        : [{ offset: statement.start, text: source.slice(statement.start, statement.end) }];
    }),
  );
}

function lineOf(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}

export function auditWaterfalls(files: ChangedFile[], read: (path: string) => string): Flag[] {
  return files.flatMap((file) => {
    if (!SOURCE.test(file.path) || file.added.length === 0) {
      return [];
    }

    const source = read(file.path);
    const added = new Set(file.added.map(({ line }) => line));

    const hits = findWaterfalls(file.path, source)
      .map((hit) => ({ ...hit, line: lineOf(source, hit.offset) }))
      .filter((hit) => added.has(hit.line));

    return hits.length > 0
      ? [
          {
            lines: hits.map((hit) => hit.line),
            path: file.path,
            rule: WATERFALL_RULE,
            sample: (hits[0]?.text.split("\n")[0] ?? "").trim().slice(0, SAMPLE_LENGTH),
          },
        ]
      : [];
  });
}
