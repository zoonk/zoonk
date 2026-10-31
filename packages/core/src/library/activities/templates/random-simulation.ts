import { z } from "zod";
import { labelSchema } from "../../steps/contract/content-schemas";
import { unitSchema } from "../activity-schemas";
import { defineActivityTemplate } from "../define-activity-template";
import {
  binomialHitProbability,
  diceSumHitProbability,
  sharedBirthdayProbability,
} from "./_utils/probability";
import { issue } from "./_utils/template-helpers";

const MAX_TRIALS = 1000;
const MAX_DICE = 10;
const MAX_SIDES = 20;
const MAX_DAYS = 366;
const MIN_RUNS = 10;
const MAX_RUNS = 10_000;
const MAX_SAMPLE_SIZES = 5;
const MAX_SAMPLE_SIZE = 100_000;

const hitSchema = z
  .object({
    comparison: z.enum(["atLeast", "atMost", "exactly"]),
    value: z.number().int().nonnegative(),
  })
  .strict();

const randomModelSchema = z.discriminatedUnion("kind", [
  z
    .object({
      hit: hitSchema,
      kind: z.literal("binomial"),
      probability: z.number().gt(0).lt(1),
      trials: z.number().int().min(1).max(MAX_TRIALS),
    })
    .strict(),
  z
    .object({
      count: z.number().int().min(1).max(MAX_DICE),
      hit: hitSchema,
      kind: z.literal("diceSum"),
      sides: z.number().int().min(2).max(MAX_SIDES),
    })
    .strict(),
  z
    .object({
      days: z.number().int().min(2).max(MAX_DAYS),
      kind: z.literal("sharedBirthday"),
      people: z.number().int().min(2).max(MAX_DAYS),
    })
    .strict(),
]);

const populationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("proportion"), proportion: z.number().gt(0).lt(1) }).strict(),
  z.object({ kind: z.literal("mean"), mean: z.number(), sd: z.number().positive() }).strict(),
]);

const randomSimulationFields = z.discriminatedUnion("mode", [
  z
    .object({
      hitLabel: labelSchema,
      mode: z.literal("chance"),
      model: randomModelSchema,
      runs: z.number().int().min(MIN_RUNS).max(MAX_RUNS),
      trialLabel: labelSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal("sampling"),
      population: populationSchema,
      populationLabel: labelSchema,
      runs: z.number().int().min(MIN_RUNS).max(MAX_TRIALS),
      sampleSizes: z
        .array(z.number().int().min(2).max(MAX_SAMPLE_SIZE))
        .min(2)
        .max(MAX_SAMPLE_SIZES),
      sizeLabel: labelSchema.optional(),
      unit: unitSchema.optional(),
    })
    .strict(),
]);

type RandomSimulationFields = z.output<typeof randomSimulationFields>;
type SamplingFields = Extract<RandomSimulationFields, { mode: "sampling" }>;

function hitProbability(model: z.output<typeof randomModelSchema>): number {
  switch (model.kind) {
    case "binomial":
      return binomialHitProbability(model);
    case "diceSum":
      return diceSumHitProbability(model);
    case "sharedBirthday":
      return sharedBirthdayProbability(model);
    default:
      return 0;
  }
}

function standardError(population: SamplingFields["population"], size: number): number {
  const spread =
    population.kind === "proportion"
      ? Math.sqrt(population.proportion * (1 - population.proportion))
      : population.sd;

  return spread / Math.sqrt(size);
}

function samplingValue(
  fields: SamplingFields,
  target: { inputs: Readonly<Record<string, number>>; output: string | null },
): number | null {
  const { sampleSize } = target.inputs;
  const [smallest = 1] = fields.sampleSizes;
  const largest = fields.sampleSizes.at(-1) ?? smallest;

  if (target.output === "standardError") {
    return sampleSize !== undefined && fields.sampleSizes.includes(sampleSize)
      ? standardError(fields.population, sampleSize)
      : null;
  }

  return standardError(fields.population, largest) / standardError(fields.population, smallest);
}

function randomSimulationIssues(fields: RandomSimulationFields) {
  if (fields.mode === "chance") {
    return hitProbability(fields.model) > 0
      ? []
      : [issue("inconsistentFields", "fields.model", "The hit can never happen")];
  }

  return fields.sampleSizes.every(
    (size, index) => index === 0 || size > (fields.sampleSizes[index - 1] ?? size),
  )
    ? []
    : [
        issue(
          "inconsistentFields",
          "fields.sampleSizes",
          "Sample sizes must grow from small to large",
        ),
      ];
}

export const randomSimulationTemplate = defineActivityTemplate({
  checks: ["choice", "numeric"],
  checksFor: (fields) => (fields.mode === "chance" ? ["choice"] : ["choice", "numeric"]),
  choicesNeedValues: (fields) => fields.mode === "chance",
  description:
    'Run something random hundreds of times and watch the results settle. Mode "chance": guess how often a hit happens (binomial trials, a sum of dice or a shared birthday), then run it and compare; code computes the exact chance, each guess option carries the chance it stands for in `value` and the closest one is correct (choice checks only). Mode "sampling": many polls or samples of each size from a population (a proportion or a mean with its unit), so the spread of results shrinks as samples grow; by default the computed answer is how much the error shrinks from the smallest to the largest sample (standard error ratio), and with `output` "standardError" and a `sampleSize` input it is that size\'s standard error. Fills: the model or population, what a trial and a hit are or what a sample size counts, the number of runs and the check question.',
  fields: randomSimulationFields,
  id: "randomSimulation",
  needsData: (fields) => fields.mode === "sampling",
  value: (fields, target) =>
    fields.mode === "chance" ? hitProbability(fields.model) : samplingValue(fields, target),
  verify: (fields) => randomSimulationIssues(fields),
});
