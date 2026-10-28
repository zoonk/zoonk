import { z } from "zod";
import { toleranceSchema } from "./activity-schemas";

const cellSchema = z.union([z.string(), z.number(), z.null()]);

const formulaExampleSchema = z.object({
  inputs: z.record(z.string(), z.number()).meta({ description: "Each variable's value" }),
  output: z.number().meta({ description: "What the formula gives for those inputs" }),
});

export type ActivityCell = z.infer<typeof cellSchema>;

export type ActivityFormulaExample = z.infer<typeof formulaExampleSchema>;

export const activityExpectedAnswerSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("assignment"),
        pairs: z
          .record(z.string(), z.string())
          .meta({
            description:
              "What goes in each slot the canvas names (a numbered part, a blank, an item), by its key",
          }),
      })
      .meta({ id: "ActivityExpectedAssignment" }),
    z
      .object({
        curve: z.string().meta({ description: "The id of the line that moves" }),
        direction: z.enum(["down", "left", "right", "up"]),
        kind: z.literal("curveShift"),
      })
      .meta({ id: "ActivityExpectedCurveShift" }),
    z
      .object({
        examples: z
          .array(formulaExampleSchema)
          .meta({ description: "Inputs a right formula turns into these outputs" }),
        kind: z.literal("formula"),
        tolerance: toleranceSchema,
      })
      .meta({ id: "ActivityExpectedFormula" }),
    z
      .object({ cells: z.array(z.string()), kind: z.literal("grid") })
      .meta({ id: "ActivityExpectedGrid" }),
    z
      .object({
        kind: z.literal("links"),
        links: z.array(z.object({ from: z.string(), to: z.string() })),
      })
      .meta({ id: "ActivityExpectedLinks" }),
    z
      .object({
        elements: z
          .record(z.string(), z.number())
          .meta({ description: "How many atoms of each element the molecule has" }),
        kind: z.literal("molecule"),
      })
      .meta({ id: "ActivityExpectedMolecule" }),
    z
      .object({
        ids: z.array(z.string()).meta({ description: "Every item's id, in order" }),
        kind: z.literal("order"),
      })
      .meta({ id: "ActivityExpectedOrder" }),
    z
      .object({
        kind: z.literal("output"),
        output: z.string().meta({ description: "What the program prints" }),
      })
      .meta({ id: "ActivityExpectedOutput" }),
    z
      .object({
        kind: z.literal("pitchClasses"),
        pitchClasses: z
          .array(z.number())
          .meta({ description: "The notes to play, as pitch classes from 0 (C) to 11 (B)" }),
      })
      .meta({ id: "ActivityExpectedPitchClasses" }),
    z
      .object({
        kind: z.literal("regex"),
        shouldMatch: z.array(z.string()),
        shouldNotMatch: z.array(z.string()),
      })
      .meta({ id: "ActivityExpectedRegex" }),
    z
      .object({
        kind: z.literal("rhythm"),
        tapTimesMs: z.array(z.number()).meta({ description: "When each tap falls" }),
        toleranceMs: z.number(),
      })
      .meta({ id: "ActivityExpectedRhythm" }),
    z
      .object({
        columns: z.array(z.string()),
        kind: z.literal("rows"),
        orderMatters: z.boolean(),
        rows: z.array(z.array(cellSchema)),
      })
      .meta({ id: "ActivityExpectedRows" }),
    z
      .object({
        ids: z.array(z.string()).meta({ description: "The ids to select, in any order" }),
        kind: z.literal("selection"),
      })
      .meta({ id: "ActivityExpectedSelection" }),
  ])
  .meta({ id: "ActivityExpectedAnswer" });

export type ActivityExpectedAnswer = z.infer<typeof activityExpectedAnswerSchema>;

export const activityExpectedSchema = z
  .discriminatedUnion("kind", [
    z
      .object({ kind: z.literal("choice"), optionId: z.string() })
      .meta({ id: "ActivityExpectedChoice" }),
    z
      .object({ answer: activityExpectedAnswerSchema, kind: z.literal("interaction") })
      .meta({ id: "ActivityExpectedInteraction" }),
    z
      .object({ kind: z.literal("numeric"), value: z.number() })
      .meta({ id: "ActivityExpectedNumeric" }),
  ])
  .meta({ id: "ActivityExpected" });

export type ActivityExpected = z.infer<typeof activityExpectedSchema>;
