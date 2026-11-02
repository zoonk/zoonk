import { z } from "zod";
import {
  explanationSchema,
  optionTextSchema,
  promptSchema,
} from "../../steps/contract/content-schemas";
import { type ActivityFormulaExample } from "../activity-expected-answer";
import { expressionSchema, namedValueSchema, toleranceSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import {
  MAX_PATTERN_LENGTH,
  compileSafeRegex,
  formulaPassesExamples,
  regexPassesExamples,
} from "./_utils/pattern-checks";
import { issue } from "./_utils/template-helpers";

const MAX_SAMPLES = 6;
const MAX_SAMPLE_LENGTH = 40;
const MAX_HINTS = 4;
const MAX_INPUTS = 6;

const sampleSchema = z.string().max(MAX_SAMPLE_LENGTH);

const hintsSchema = z
  .array(z.object({ hint: explanationSchema, mistake: optionTextSchema }).strict())
  .max(MAX_HINTS);

const patternTesterFields = z.discriminatedUnion("mode", [
  z
    .object({
      hints: hintsSchema,
      mode: z.literal("regex"),
      shouldMatch: z.array(sampleSchema).min(1).max(MAX_SAMPLES),
      shouldNotMatch: z.array(sampleSchema).min(1).max(MAX_SAMPLES),
      solution: z.string().min(1).max(MAX_PATTERN_LENGTH),
      task: promptSchema,
    })
    .strict(),
  z
    .object({
      examples: z
        .array(
          z
            .object({
              inputs: z.array(namedValueSchema).min(1).max(MAX_INPUTS),
              output: z.number(),
            })
            .strict(),
        )
        .min(2)
        .max(MAX_SAMPLES),
      hints: hintsSchema,
      mode: z.literal("formula"),
      solution: expressionSchema,
      task: promptSchema,
      tolerance: toleranceSchema,
    })
    .strict(),
]);

type FormulaFields = Extract<z.output<typeof patternTesterFields>, { mode: "formula" }>;

function formulaExamples(fields: FormulaFields): ActivityFormulaExample[] {
  return fields.examples.map((example) => ({
    inputs: Object.fromEntries(example.inputs.map((input) => [input.name, input.value])),
    output: example.output,
  }));
}

export const patternTesterTemplate = defineActivityTemplate({
  checks: ["interaction"],
  description:
    'Write a regular expression (mode "regex") or a spreadsheet-style formula (mode "formula", cells as variables like A1) and see it checked live against examples, like US ZIP codes. Code runs the reference solution against every example before publishing. Regexes use JavaScript syntax; repeated groups that repeat or alternate inside are refused. Fills: the task, examples that should and should not match (or inputs with outputs), the solution and hints for likely mistakes.',
  expected: (fields) =>
    fields.mode === "regex"
      ? { kind: "regex", shouldMatch: fields.shouldMatch, shouldNotMatch: fields.shouldNotMatch }
      : { examples: formulaExamples(fields), kind: "formula", tolerance: fields.tolerance },
  fields: patternTesterFields,
  id: "patternTester",
  needsData: false,
  verify: (fields) => {
    if (fields.mode === "formula") {
      return formulaPassesExamples(fields.solution, {
        examples: formulaExamples(fields),
        tolerance: fields.tolerance,
      })
        ? []
        : [
            issue(
              "answerMismatch",
              "fields.solution",
              "The solution doesn't give every example's output",
            ),
          ];
    }

    if (!compileSafeRegex(fields.solution)) {
      return [
        issue("inconsistentFields", "fields.solution", "The pattern is invalid or too slow to run"),
      ];
    }

    return regexPassesExamples(fields.solution, fields)
      ? []
      : [
          issue(
            "answerMismatch",
            "fields.solution",
            "The solution doesn't sort the examples correctly",
          ),
        ];
  },
});
