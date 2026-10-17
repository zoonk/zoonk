import {
  type ExpressionConstantName,
  type ExpressionFunctionName,
  expressionFunctions,
  isExpressionConstantName,
  isExpressionFunctionName,
} from "./expression-functions";

const MAX_EXPRESSION_LENGTH = 300;
const MAX_NESTING_DEPTH = 32;

type BinaryOperator = "+" | "-" | "*" | "/" | "^";

export type ExpressionNode =
  | { kind: "binary"; left: ExpressionNode; operator: BinaryOperator; right: ExpressionNode }
  | { kind: "call"; name: ExpressionFunctionName; args: ExpressionNode[] }
  | { kind: "constant"; name: ExpressionConstantName }
  | { kind: "negate"; argument: ExpressionNode }
  | { kind: "number"; value: number }
  | { kind: "variable"; name: string };

export type ParsedExpression = { ast: ExpressionNode; source: string; variables: string[] };

type ExpressionError = { message: string; position: number };

export type ParseExpressionResult =
  | { ok: true; expression: ParsedExpression }
  | { ok: false; error: ExpressionError };

type Token =
  | { kind: "end"; position: number }
  | { kind: "identifier"; name: string; position: number }
  | { kind: "number"; position: number; value: number }
  | { kind: "symbol"; position: number; symbol: string };

type Failure = { error: ExpressionError; ok: false };
type ParseStep = { index: number; node: ExpressionNode; ok: true } | Failure;
type ArgumentsStep = { index: number; nodes: ExpressionNode[]; ok: true } | Failure;
type NextParser = (tokens: readonly Token[], index: number, depth: number) => ParseStep;

const tokenPattern =
  /(?<space>\s+)|(?<number>(?:\d+\.?\d*|\.\d+)(?:[Ee][+-]?\d+)?)|(?<identifier>[A-Z_a-z]\w*)|(?<symbol>[(),*+/^-])|(?<invalid>.)/gu;

function fail(position: number, message: string): Failure {
  return { error: { message, position }, ok: false };
}

function toToken(match: RegExpExecArray): Token[] {
  const { identifier, number, symbol } = match.groups ?? {};
  const position = match.index;

  if (number) {
    return [{ kind: "number", position, value: Number(number) }];
  }

  if (identifier) {
    return [{ kind: "identifier", name: identifier, position }];
  }

  return symbol ? [{ kind: "symbol", position, symbol }] : [];
}

function tokenize(source: string): { ok: true; tokens: Token[] } | Failure {
  const matches = [...source.matchAll(tokenPattern)];
  const invalid = matches.find((match) => match.groups?.invalid);

  if (invalid) {
    return fail(invalid.index, `Unexpected character "${invalid[0]}"`);
  }

  return {
    ok: true,
    tokens: [
      ...matches.flatMap((match) => toToken(match)),
      { kind: "end", position: source.length },
    ],
  };
}

function tokenAt(tokens: readonly Token[], index: number): Token {
  return tokens[index] ?? { kind: "end", position: tokens.at(-1)?.position ?? 0 };
}

function isSymbol(token: Token, symbol: string): boolean {
  return token.kind === "symbol" && token.symbol === symbol;
}

function describeToken(token: Token): string {
  if (token.kind === "end") {
    return "the end of the expression";
  }

  if (token.kind === "number") {
    return `"${String(token.value)}"`;
  }

  return `"${token.kind === "identifier" ? token.name : token.symbol}"`;
}

function binaryOperatorAt(token: Token, operators: readonly BinaryOperator[]) {
  return token.kind === "symbol"
    ? operators.find((operator) => operator === token.symbol)
    : undefined;
}

/**
 * Left-associative operators (`a - b - c` is `(a - b) - c`) are parsed as a head followed by a
 * tail, so each operator wraps everything to its left.
 */
function parseBinaryTail(params: {
  depth: number;
  index: number;
  left: ExpressionNode;
  next: NextParser;
  operators: readonly BinaryOperator[];
  tokens: readonly Token[];
}): ParseStep {
  const { depth, index, left, next, operators, tokens } = params;
  const operator = binaryOperatorAt(tokenAt(tokens, index), operators);

  if (!operator) {
    return { index, node: left, ok: true };
  }

  const right = next(tokens, index + 1, depth);

  if (!right.ok) {
    return right;
  }

  return parseBinaryTail({
    ...params,
    index: right.index,
    left: { kind: "binary", left, operator, right: right.node },
  });
}

function parseAdditive(tokens: readonly Token[], index: number, depth: number): ParseStep {
  const head = parseMultiplicative(tokens, index, depth);

  return head.ok
    ? parseBinaryTail({
        depth,
        index: head.index,
        left: head.node,
        next: parseMultiplicative,
        operators: ["+", "-"],
        tokens,
      })
    : head;
}

function parseMultiplicative(tokens: readonly Token[], index: number, depth: number): ParseStep {
  const head = parseUnary(tokens, index, depth);

  return head.ok
    ? parseBinaryTail({
        depth,
        index: head.index,
        left: head.node,
        next: parseUnary,
        operators: ["*", "/"],
        tokens,
      })
    : head;
}

/**
 * Unary minus binds looser than `^`, so `-2^2` is -4 as in written math, while `2^-1` still works
 * because the exponent is itself a unary expression.
 */
function parseUnary(tokens: readonly Token[], index: number, depth: number): ParseStep {
  const token = tokenAt(tokens, index);

  if (depth > MAX_NESTING_DEPTH) {
    return fail(token.position, "Expression is nested too deeply");
  }

  if (isSymbol(token, "+")) {
    return parseUnary(tokens, index + 1, depth + 1);
  }

  if (!isSymbol(token, "-")) {
    return parsePower(tokens, index, depth);
  }

  const argument = parseUnary(tokens, index + 1, depth + 1);

  return argument.ok
    ? { index: argument.index, node: { argument: argument.node, kind: "negate" }, ok: true }
    : argument;
}

/** `^` is right-associative: `2^3^2` is `2^(3^2)`. */
function parsePower(tokens: readonly Token[], index: number, depth: number): ParseStep {
  const base = parsePrimary(tokens, index, depth);

  if (!base.ok || !isSymbol(tokenAt(tokens, base.index), "^")) {
    return base;
  }

  const exponent = parseUnary(tokens, base.index + 1, depth + 1);

  return exponent.ok
    ? {
        index: exponent.index,
        node: { kind: "binary", left: base.node, operator: "^", right: exponent.node },
        ok: true,
      }
    : exponent;
}

function parseGroup(tokens: readonly Token[], index: number, depth: number): ParseStep {
  const inner = parseAdditive(tokens, index + 1, depth + 1);

  if (!inner.ok) {
    return inner;
  }

  const closing = tokenAt(tokens, inner.index);

  return isSymbol(closing, ")")
    ? { index: inner.index + 1, node: inner.node, ok: true }
    : fail(closing.position, `Expected ")" but found ${describeToken(closing)}`);
}

function parseArguments(
  tokens: readonly Token[],
  index: number,
  depth: number,
  nodes: ExpressionNode[],
): ArgumentsStep {
  if (nodes.length === 0 && isSymbol(tokenAt(tokens, index), ")")) {
    return { index: index + 1, nodes, ok: true };
  }

  const argument = parseAdditive(tokens, index, depth);

  if (!argument.ok) {
    return argument;
  }

  const next = tokenAt(tokens, argument.index);
  const collected = [...nodes, argument.node];

  if (isSymbol(next, ",")) {
    return parseArguments(tokens, argument.index + 1, depth, collected);
  }

  return isSymbol(next, ")")
    ? { index: argument.index + 1, nodes: collected, ok: true }
    : fail(next.position, `Expected "," or ")" but found ${describeToken(next)}`);
}

function parseCall(tokens: readonly Token[], index: number, depth: number): ParseStep {
  const token = tokenAt(tokens, index);
  const rawName = token.kind === "identifier" ? token.name : "";
  const name = rawName.toLowerCase();

  if (!isExpressionFunctionName(name)) {
    return fail(token.position, `Unknown function "${rawName}"`);
  }

  const args = parseArguments(tokens, index + 2, depth + 1, []);

  if (!args.ok) {
    return args;
  }

  const spec = expressionFunctions[name];

  if (args.nodes.length < spec.minArgs || args.nodes.length > spec.maxArgs) {
    return fail(token.position, `"${name}" can't take ${String(args.nodes.length)} arguments`);
  }

  return { index: args.index, node: { args: args.nodes, kind: "call", name }, ok: true };
}

function parseIdentifier(tokens: readonly Token[], index: number, depth: number): ParseStep {
  const token = tokenAt(tokens, index);
  const name = token.kind === "identifier" ? token.name : "";

  if (isSymbol(tokenAt(tokens, index + 1), "(")) {
    return parseCall(tokens, index, depth);
  }

  if (isExpressionFunctionName(name.toLowerCase())) {
    return fail(token.position, `"${name}" is a function and needs parentheses`);
  }

  const node: ExpressionNode = isExpressionConstantName(name)
    ? { kind: "constant", name }
    : { kind: "variable", name };

  return { index: index + 1, node, ok: true };
}

function parsePrimary(tokens: readonly Token[], index: number, depth: number): ParseStep {
  const token = tokenAt(tokens, index);

  if (token.kind === "number") {
    return { index: index + 1, node: { kind: "number", value: token.value }, ok: true };
  }

  if (token.kind === "identifier") {
    return parseIdentifier(tokens, index, depth);
  }

  if (isSymbol(token, "(")) {
    return parseGroup(tokens, index, depth);
  }

  return token.kind === "end"
    ? fail(token.position, "The expression ends too early")
    : fail(token.position, `Unexpected ${describeToken(token)}`);
}

function collectVariables(node: ExpressionNode): string[] {
  switch (node.kind) {
    case "variable":
      return [node.name];
    case "negate":
      return collectVariables(node.argument);
    case "binary":
      return [...collectVariables(node.left), ...collectVariables(node.right)];
    case "call":
      return node.args.flatMap((arg) => collectVariables(arg));
    case "constant":
    case "number":
      return [];
    default:
      return [];
  }
}

/**
 * Parses a formula written by a model into an AST without ever running code: numbers, variables,
 * `+ - * / ^`, parentheses, unary minus, the constants `pi` and `e`, and whitelisted functions.
 * Implicit multiplication (`2x`) is rejected so every formula reads one way only.
 */
export function parseExpression(source: string): ParseExpressionResult {
  if (source.length > MAX_EXPRESSION_LENGTH) {
    return fail(MAX_EXPRESSION_LENGTH, "Expression is too long");
  }

  const tokenized = tokenize(source);

  if (!tokenized.ok) {
    return tokenized;
  }

  const parsed = parseAdditive(tokenized.tokens, 0, 0);

  if (!parsed.ok) {
    return parsed;
  }

  const trailing = tokenAt(tokenized.tokens, parsed.index);

  if (trailing.kind !== "end") {
    return fail(trailing.position, `Unexpected ${describeToken(trailing)}`);
  }

  const variables = [...new Set(collectVariables(parsed.node))].toSorted();

  return { expression: { ast: parsed.node, source, variables }, ok: true };
}
