import { z } from "zod";
import {
  explanationSchema,
  labelSchema,
  optionTextSchema,
} from "../../steps/contract/content-schemas";
import { expressionSchema, identifierSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { parseExpression } from "../expression/parse-expression";
import { solveLinearEquation } from "./_utils/linear-equation";
import { isClose, issue } from "./_utils/template-helpers";

const MAX_HINTS = 4;
const MAX_OBJECTS = 3;
const MAX_STEPS = 4;
const MAX_SYMBOL_LENGTH = 3;

const equationSchema = z.object({ left: expressionSchema, right: expressionSchema }).strict();

const balanceFields = z
  .object({
    equation: equationSchema,
    hints: z
      .array(z.object({ hint: explanationSchema, move: optionTextSchema }).strict())
      .min(1)
      .max(MAX_HINTS),
    objects: z
      .array(
        z.object({ label: labelSchema, symbol: z.string().min(1).max(MAX_SYMBOL_LENGTH) }).strict(),
      )
      .min(1)
      .max(MAX_OBJECTS),
    steps: z
      .array(equationSchema.extend({ move: optionTextSchema }).strict())
      .min(1)
      .max(MAX_STEPS),
    variable: identifierSchema,
  })
  .strict();

type BalanceFields = z.output<typeof balanceFields>;

function usesOnly(expression: string, allowed: readonly string[]): boolean {
  const parsed = parseExpression(expression);
  return parsed.ok && parsed.expression.variables.every((name) => allowed.includes(name));
}

function isSolvedForm(step: { left: string; right: string }, variable: string): boolean {
  const [left, right] = [step.left.trim(), step.right.trim()];

  return (left === variable && usesOnly(right, [])) || (right === variable && usesOnly(left, []));
}

function stepIssues(fields: BalanceFields, solution: number) {
  return fields.steps.flatMap((step, index) => {
    const stepSolution = solveLinearEquation({ ...step, variable: fields.variable });

    return stepSolution !== null && isClose(stepSolution, solution)
      ? []
      : [
          issue(
            "answerMismatch",
            `fields.steps.${index}`,
            `After "${step.move}" the equation no longer has the solution ${String(solution)}`,
          ),
        ];
  });
}

function verifyBalance(fields: BalanceFields) {
  const { equation, steps, variable } = fields;
  const solution = solveLinearEquation({ ...equation, variable });
  const lastStep = steps.at(-1);

  if (!usesOnly(equation.left, [variable]) || !usesOnly(equation.right, [variable])) {
    return [
      issue("inconsistentFields", "fields.equation", `The equation may only use "${variable}"`),
    ];
  }

  if (solution === null) {
    return [issue("inconsistentFields", "fields.equation", "The equation has no single solution")];
  }

  return [
    ...stepIssues(fields, solution),
    ...(lastStep && isSolvedForm(lastStep, variable)
      ? []
      : [
          issue(
            "inconsistentFields",
            "fields.steps",
            `The last step must read "${variable} = number"`,
          ),
        ]),
  ];
}

export const balanceTemplate = defineActivityTemplate({
  checks: ["numeric"],
  description:
    "An equation as a balance: the learner takes the same thing off both sides and watches it stay level. The equation must be linear in one variable; code solves it and checks every step keeps the same solution. Fills: the equation, what each object stands for, the solution steps and a hint for each wrong move.",
  fields: balanceFields,
  id: "balance",
  needsData: false,
  value: (fields) => solveLinearEquation({ ...fields.equation, variable: fields.variable }),
  verify: (fields) => verifyBalance(fields),
});
