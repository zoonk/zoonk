import { z } from "zod";
import {
  explanationSchema,
  idSchema,
  labelSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { unitSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { guessScaleIssues, issue } from "./_utils/template-helpers";

const MAX_FACTS = 4;

export const predictRevealTemplate = defineActivityTemplate({
  checks: ["numeric"],
  description:
    "Commit to a guess on a scale before the explanation, so the gap is memorable, like how much the usual world map shrinks Africa. The true value is cited data. Fills: the question, the scale range, the true value with its source and the explanation.",
  fields: z
    .object({
      explanation: explanationSchema,
      max: z.number(),
      min: z.number(),
      scale: z.enum(["linear", "log"]),
      trueValue: z.number(),
      unit: unitSchema,
    })
    .strict(),
  id: "predictReveal",
  needsData: true,
  value: (fields) => fields.trueValue,
  verify: (fields) => guessScaleIssues({ ...fields, trueValuePath: "fields.trueValue" }),
});

const factSchema = z
  .object({ id: idSchema, label: labelSchema, unit: unitSchema.optional(), value: z.number() })
  .strict();

const stateSchema = z
  .object({
    description: explanationSchema,
    facts: uniqueIdsSchema(factSchema, { max: MAX_FACTS, min: 1 }),
    label: labelSchema,
  })
  .strict();

type BeforeAfterFields = {
  after: z.output<typeof stateSchema>;
  before: z.output<typeof stateSchema>;
};

function changeRatio(fields: BeforeAfterFields, factId: string | undefined): number | null {
  const before = fields.before.facts.find((fact) => fact.id === factId)?.value;
  const after = fields.after.facts.find((fact) => fact.id === factId)?.value;

  return before === undefined || after === undefined || before === 0 ? null : after / before;
}

export const beforeAfterTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  description:
    "Compare two states side by side to see what a change really did, like Ford's factory before and after the moving assembly line. Both states list the same facts; the computed number is the after/before ratio of the fact named in `output` (default: the first). Fills: both states, what changed, the numbers with sources and the check question.",
  fields: z.object({ after: stateSchema, before: stateSchema, change: explanationSchema }).strict(),
  id: "beforeAfter",
  needsData: true,
  value: (fields, target) => changeRatio(fields, target.output ?? fields.before.facts[0]?.id),
  verify: (fields) => {
    const beforeIds = fields.before.facts.map((fact) => fact.id).join("|");
    const afterIds = fields.after.facts.map((fact) => fact.id).join("|");

    return beforeIds === afterIds
      ? []
      : [
          issue(
            "inconsistentFields",
            "fields.after.facts",
            "Both states must list the same facts in order",
          ),
        ];
  },
});
