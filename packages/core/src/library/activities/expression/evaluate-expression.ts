import {
  type ExpressionFunctionName,
  expressionConstantValue,
  expressionFunctions,
} from "./expression-functions";
import { type ExpressionNode, type ParsedExpression, parseExpression } from "./parse-expression";

export type ExpressionVariables = Readonly<Record<string, number>>;

export type EvaluateExpressionResult = { ok: true; value: number } | { ok: false; error: string };

type Failure = Extract<EvaluateExpressionResult, { ok: false }>;
type ValuesResult = { ok: true; values: number[] } | Failure;

function failure(error: string): Failure {
  return { error, ok: false };
}

/**
 * Every intermediate value must be finite, so division by zero, `0^-1` or `sqrt(-1)` fail right
 * where they happen instead of silently turning into Infinity or NaN further up the tree.
 */
function finite(value: number, description: string): EvaluateExpressionResult {
  return Number.isFinite(value)
    ? { ok: true, value }
    : failure(`${description} is not a finite number for these values`);
}

function evaluateVariable(name: string, variables: ExpressionVariables): EvaluateExpressionResult {
  const value = Object.hasOwn(variables, name) ? variables[name] : undefined;

  if (value === undefined) {
    return failure(`Unknown variable "${name}"`);
  }

  return finite(value, `Variable "${name}"`);
}

function applyOperator(operator: string, left: number, right: number): number {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return left / right;
    case "^":
      return left ** right;
    default:
      return Number.NaN;
  }
}

function evaluateAll(
  nodes: readonly ExpressionNode[],
  variables: ExpressionVariables,
): ValuesResult {
  return nodes.reduce<ValuesResult>(
    (result, node) => {
      if (!result.ok) {
        return result;
      }

      const evaluated = evaluateNode(node, variables);

      return evaluated.ok ? { ok: true, values: [...result.values, evaluated.value] } : evaluated;
    },
    { ok: true, values: [] },
  );
}

function evaluateCall(
  name: ExpressionFunctionName,
  args: readonly ExpressionNode[],
  variables: ExpressionVariables,
): EvaluateExpressionResult {
  const evaluated = evaluateAll(args, variables);

  if (!evaluated.ok) {
    return evaluated;
  }

  return finite(expressionFunctions[name].apply(evaluated.values), `${name}(...)`);
}

function evaluateBinary(
  node: Extract<ExpressionNode, { kind: "binary" }>,
  variables: ExpressionVariables,
): EvaluateExpressionResult {
  const operands = evaluateAll([node.left, node.right], variables);

  if (!operands.ok) {
    return operands;
  }

  const [left = Number.NaN, right = Number.NaN] = operands.values;

  const description =
    node.operator === "/" && right === 0 ? "Division by zero" : `"${node.operator}"`;

  return finite(applyOperator(node.operator, left, right), description);
}

function evaluateNode(
  node: ExpressionNode,
  variables: ExpressionVariables,
): EvaluateExpressionResult {
  switch (node.kind) {
    case "number":
      return finite(node.value, "Number");
    case "constant":
      return { ok: true, value: expressionConstantValue(node.name) };
    case "variable":
      return evaluateVariable(node.name, variables);
    case "negate": {
      const argument = evaluateNode(node.argument, variables);
      return argument.ok ? { ok: true, value: -argument.value } : argument;
    }
    case "binary":
      return evaluateBinary(node, variables);
    case "call":
      return evaluateCall(node.name, node.args, variables);
    default:
      return failure("Unsupported expression");
  }
}

/**
 * Evaluates a parsed formula with the given variable values. It never throws: unknown variables
 * and values outside a function's domain come back as `{ ok: false }` so validators can sample a
 * formula across its whole range safely.
 */
export function evaluateExpression(
  expression: ParsedExpression,
  variables: ExpressionVariables = {},
): EvaluateExpressionResult {
  return evaluateNode(expression.ast, variables);
}

/** Parses and evaluates a formula in one call, for callers that only need the number. */
export function evaluateFormula(
  source: string,
  variables: ExpressionVariables = {},
): EvaluateExpressionResult {
  const parsed = parseExpression(source);

  return parsed.ok
    ? evaluateExpression(parsed.expression, variables)
    : failure(parsed.error.message);
}
