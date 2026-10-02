import { z } from "zod";
import {
  explanationSchema,
  labelSchema,
  uniqueIdsSchema,
} from "../../steps/contract/content-schemas";
import { identifierSchema, outputSchema, variableSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import { parseExpression } from "../expression/parse-expression";
import { computeOutput, formulaModelIssues, outputFormulas } from "./_utils/formula-model";
import { duplicateIssues, issue } from "./_utils/template-helpers";

const MAX_VARIABLES = 4;
const MAX_OUTPUTS = 4;
const MAX_EVENTS = 4;

export const sliderCalculatorTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  description:
    "A calculator with sliders, like an extra monthly payment on a mortgage, showing how outputs such as years saved and interest change. A numeric check reads `output` (default: the first) with the sliders at `inputs`. Fills: the formulas, inputs and ranges, the example's values, output labels and the check question.",
  fields: z
    .object({
      outputs: uniqueIdsSchema(outputSchema, { max: MAX_OUTPUTS, min: 1 }),
      variables: z.array(variableSchema).min(1).max(MAX_VARIABLES),
    })
    .strict(),
  formulas: (fields) => outputFormulas(fields),
  id: "sliderCalculator",
  needsData: true,
  value: (fields, target) =>
    computeOutput({ ...fields, defaultOutput: fields.outputs[0]?.id, target }),
  verify: (fields) => formulaModelIssues(fields),
});

/** A straight curve: price = intercept + slope × quantity. */
const lineSchema = z.object({ intercept: z.number(), slope: z.number() }).strict();

const supplyDemandFields = z
  .object({
    demand: lineSchema,
    event: explanationSchema,
    feedback: z
      .object({ wrongCurve: explanationSchema, wrongDirection: explanationSchema })
      .strict(),
    priceLabel: labelSchema,
    quantityLabel: labelSchema,
    shift: z
      .object({
        amount: z.number().positive(),
        curve: z.enum(["demand", "supply"]),
        direction: z.enum(["left", "right"]),
      })
      .strict(),
    supply: lineSchema,
  })
  .strict();

type SupplyDemandFields = z.output<typeof supplyDemandFields>;
type Line = z.output<typeof lineSchema>;

/** Moving a curve right by `amount` means the same price now goes with `amount` more quantity. */
function shiftLine(line: Line, shift: SupplyDemandFields["shift"]): Line {
  const offset = shift.direction === "right" ? -shift.amount : shift.amount;
  return { intercept: line.intercept + line.slope * offset, slope: line.slope };
}

function equilibrium(supply: Line, demand: Line): { price: number; quantity: number } {
  const quantity = (demand.intercept - supply.intercept) / (supply.slope - demand.slope);
  return { price: supply.intercept + supply.slope * quantity, quantity };
}

function shiftedEquilibrium(fields: SupplyDemandFields) {
  const moves = (curve: "demand" | "supply") => fields.shift.curve === curve;

  return equilibrium(
    moves("supply") ? shiftLine(fields.supply, fields.shift) : fields.supply,
    moves("demand") ? shiftLine(fields.demand, fields.shift) : fields.demand,
  );
}

function isPositive(point: { price: number; quantity: number }): boolean {
  return point.price > 0 && point.quantity > 0;
}

export const supplyDemandTemplate = defineActivityTemplate({
  checks: ["interaction", "choice", "numeric"],
  description:
    'Drag a supply or demand curve to explain a real price change, like the 2022 egg price spike, and tell a supply shock from a demand shift. The computed number is the new equilibrium `output` "price" (default) or "quantity". Fills: the event and its cited data, the curves, which curve moves and which way, and feedback for the wrong curve or direction.',
  expected: (fields) => ({
    curve: fields.shift.curve,
    direction: fields.shift.direction,
    kind: "curveShift",
  }),
  fields: supplyDemandFields,
  id: "supplyDemand",
  needsData: true,
  value: (fields, target) => {
    const point = shiftedEquilibrium(fields);
    return target.output === "quantity" ? point.quantity : point.price;
  },
  verify: (fields) =>
    [
      fields.supply.slope <= 0 &&
        issue("inconsistentFields", "fields.supply", "Supply must slope upward"),
      fields.demand.slope >= 0 &&
        issue("inconsistentFields", "fields.demand", "Demand must slope downward"),
      fields.supply.slope > 0 &&
        fields.demand.slope < 0 &&
        !(
          isPositive(equilibrium(fields.supply, fields.demand)) &&
          isPositive(shiftedEquilibrium(fields))
        ) &&
        issue(
          "inconsistentFields",
          "fields",
          "The curves must cross at a positive price and quantity",
        ),
    ].filter((item) => item !== false),
});

const scenarioFields = z
  .object({
    events: z
      .array(z.object({ label: labelSchema, name: identifierSchema }).strict())
      .min(1)
      .max(MAX_EVENTS),
    outputs: uniqueIdsSchema(outputSchema, { max: MAX_OUTPUTS, min: 1 }),
    variables: z.array(variableSchema).min(1).max(MAX_VARIABLES),
  })
  .strict();

type ScenarioFields = z.output<typeof scenarioFields>;

function eventsOff(fields: ScenarioFields): Record<string, number> {
  return Object.fromEntries(fields.events.map((event) => [event.name, 0]));
}

function scenarioIssues(fields: ScenarioFields) {
  const used = new Set(
    fields.outputs.flatMap((output) => {
      const parsed = parseExpression(output.formula);
      return parsed.ok ? parsed.expression.variables : [];
    }),
  );

  return [
    ...formulaModelIssues(fields),
    ...duplicateIssues(
      [
        ...fields.variables.map((variable) => variable.name),
        ...fields.events.map((event) => event.name),
      ],
      "fields.events",
      "Name",
    ),
    ...fields.events
      .filter((event) => !used.has(event.name))
      .map((event) =>
        issue("missingInteraction", "fields.events", `Event "${event.name}" changes nothing`),
      ),
  ];
}

export const scenarioSimulatorTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  description:
    'Turn "what if" events on and off while moving levers, like higher rent for a coffee cart. Events are 0/1 names the formulas use (off by default); a check turns one on with an input of 1. A numeric check reads `output` (default: the first). Fills: the business formulas, levers and ranges, the what-if events and the check question.',
  fields: scenarioFields,
  formulas: (fields) =>
    outputFormulas({
      ...fields,
      extraRanges: fields.events.map((event) => ({ max: 1, min: 0, name: event.name, step: 1 })),
    }),
  id: "scenarioSimulator",
  needsData: true,
  value: (fields, target) =>
    computeOutput({
      ...fields,
      defaultOutput: fields.outputs[0]?.id,
      fixed: eventsOff(fields),
      target,
    }),
  verify: (fields) => scenarioIssues(fields),
});
