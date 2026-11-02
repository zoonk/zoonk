import { type Node, parse } from "acorn";

const STEP = "__zoonkStep";
const TEST = "__zoonkTest";
const READ = "__zoonkRead";

const AFTER = new Set([
  "ClassDeclaration",
  "ExpressionStatement",
  "FunctionDeclaration",
  "VariableDeclaration",
]);

const BEFORE = new Set([
  "BreakStatement",
  "ContinueStatement",
  "ReturnStatement",
  "ThrowStatement",
]);

const STATEMENT_LISTS: Readonly<Record<string, string>> = {
  BlockStatement: "body",
  Program: "body",
  StaticBlock: "body",
  SwitchCase: "consequent",
};

const BODIES: Readonly<Record<string, readonly string[]>> = {
  DoWhileStatement: ["body"],
  ForInStatement: ["body"],
  ForOfStatement: ["body"],
  ForStatement: ["body"],
  IfStatement: ["consequent", "alternate"],
  WhileStatement: ["body"],
  WithStatement: ["body"],
};

const CONDITIONS: Readonly<Record<string, readonly string[]>> = {
  DoWhileStatement: ["test"],
  ForStatement: ["test", "update"],
  IfStatement: ["test"],
  SwitchStatement: ["discriminant"],
  WhileStatement: ["test"],
};

type Child = { key: string; node: Node };
type Rewriter = { code: string; reader: string };

export type InstrumentedProgram =
  | { code: string; ok: true }
  | { error: { line: number | null; message: string }; ok: false };

function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string" &&
    "start" in value &&
    typeof value.start === "number"
  );
}

function childrenOf(node: Node): Child[] {
  return Object.entries(node)
    .flatMap(([key, value]): Child[] => {
      if (Array.isArray(value)) {
        return value.filter((item) => isNode(item)).map((item) => ({ key, node: item }));
      }

      return key !== "loc" && isNode(value) ? [{ key, node: value }] : [];
    })
    .toSorted((first, second) => first.node.start - second.node.start);
}

function lineOf(node: Node): number {
  return node.loc?.start.line ?? 1;
}

function step(rewriter: Rewriter, line: number): string {
  return `${STEP}(${line}, ${rewriter.reader});`;
}

function startsEachPass(parent: Node): boolean {
  return (
    parent.type === "ForInStatement" ||
    parent.type === "ForOfStatement" ||
    (parent.type === "ForStatement" && !isNode(Reflect.get(parent, "test")))
  );
}

function probed(rewriter: Rewriter, node: Node): string {
  if (BEFORE.has(node.type)) {
    return `${step(rewriter, lineOf(node))}${rewrite(rewriter, node)}`;
  }

  return AFTER.has(node.type)
    ? `${rewrite(rewriter, node)};${step(rewriter, lineOf(node))}`
    : rewrite(rewriter, node);
}

function body(rewriter: Rewriter, parent: Node, node: Node): string {
  const start = startsEachPass(parent) ? step(rewriter, lineOf(parent)) : "";

  if (node.type === "BlockStatement") {
    return `{${start}${rewrite(rewriter, node).slice(1)}`;
  }

  return `{${start}${probed(rewriter, node)}}`;
}

function condition(rewriter: Rewriter, parent: Node, { key, node }: Child): string {
  const line = parent.type === "DoWhileStatement" && key === "test" ? lineOf(node) : lineOf(parent);
  return `${TEST}(${line}, (${rewrite(rewriter, node)}), ${rewriter.reader})`;
}

function transform(rewriter: Rewriter, parent: Node, child: Child): string {
  if (STATEMENT_LISTS[parent.type] === child.key) {
    return probed(rewriter, child.node);
  }

  if (BODIES[parent.type]?.includes(child.key)) {
    return body(rewriter, parent, child.node);
  }

  return CONDITIONS[parent.type]?.includes(child.key)
    ? condition(rewriter, parent, child)
    : rewrite(rewriter, child.node);
}

function rewrite(rewriter: Rewriter, node: Node): string {
  const initial: { cursor: number; parts: string[] } = { cursor: node.start, parts: [] };

  const { cursor, parts } = childrenOf(node).reduce(
    (state, child) =>
      child.node.start < state.cursor
        ? state
        : {
            cursor: child.node.end,
            parts: [
              ...state.parts,
              rewriter.code.slice(state.cursor, child.node.start),
              transform(rewriter, node, child),
            ],
          },
    initial,
  );

  return [...parts, rewriter.code.slice(cursor, node.end)].join("");
}

function syntaxError(error: SyntaxError): InstrumentedProgram {
  const location: unknown = Reflect.get(error, "loc");

  const line: unknown =
    typeof location === "object" && location !== null ? Reflect.get(location, "line") : null;

  return {
    error: {
      line: typeof line === "number" ? line : null,
      message: `SyntaxError: ${error.message}`,
    },
    ok: false,
  };
}

export function instrumentJavaScript({
  code,
  watch,
}: {
  code: string;
  watch: readonly string[];
}): InstrumentedProgram {
  try {
    const program = parse(code, {
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      ecmaVersion: "latest",
      locations: true,
      sourceType: "script",
    });

    const reader = `() => [${watch.map((name) => `${READ}(() => ${name})`).join(", ")}]`;
    return { code: rewrite({ code, reader }, program), ok: true };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return syntaxError(error);
    }

    throw error;
  }
}
