import { aimForCharacters } from "@zoonk/utils/character-target";
import { z } from "zod";
import {
  choiceOptionSchema,
  choiceOptionsSchema,
  citationSchema,
  explanationSchema,
  idSchema,
  labelSchema,
  promptSchema,
} from "../steps/contract/content-schemas";

const EXPRESSION_TARGET = 300;
const CODE_TARGET = 2000;
const UNIT_TARGET = 16;
const SLUG_TARGET = 60;
const MAX_CHECK_INPUTS = 6;

export const expressionSchema = aimForCharacters(z.string().min(1), EXPRESSION_TARGET);

export const identifierSchema = z.string().regex(/^[A-Z_a-z]\w*$/u);

export const unitSchema = aimForCharacters(z.string().min(1), UNIT_TARGET);
export const codeSchema = aimForCharacters(z.string().min(1), CODE_TARGET);

export const slugSchema = aimForCharacters(
  z.string().regex(/^[\da-z]+(?:-[\da-z]+)*$/u),
  SLUG_TARGET,
);

export const variableSchema = z
  .object({
    initial: z.number(),
    label: labelSchema,
    max: z.number(),
    min: z.number(),
    name: identifierSchema,
    step: z.number().positive(),
    unit: unitSchema.optional(),
  })
  .strict();

export const outputSchema = z
  .object({
    formula: expressionSchema,
    id: idSchema,
    label: labelSchema,
    unit: unitSchema.optional(),
  })
  .strict();

export const toleranceSchema = z
  .object({ kind: z.enum(["absolute", "relative"]), value: z.number().nonnegative() })
  .strict();

export const namedValueSchema = z.object({ name: identifierSchema, value: z.number() }).strict();

export const activityDataSchema = z.union([
  z.object({ isExample: z.literal(true) }).strict(),
  z.object({ source: citationSchema }).strict(),
]);

const checkTargetShape = {
  inputs: z.array(namedValueSchema).max(MAX_CHECK_INPUTS).optional(),
  output: idSchema.optional(),
};

const activityChoiceOptionSchema = choiceOptionSchema
  .extend({ value: z.number().optional() })
  .strict();

const choiceCheckSchema = z
  .object({
    ...checkTargetShape,
    kind: z.literal("choice"),
    options: choiceOptionsSchema(activityChoiceOptionSchema),
    question: promptSchema,
  })
  .strict();

const numericCheckSchema = z
  .object({
    ...checkTargetShape,
    answer: z.number(),
    explanation: explanationSchema,
    kind: z.literal("numeric"),
    question: promptSchema,
    tolerance: toleranceSchema,
    unit: unitSchema.optional(),
  })
  .strict();

const interactionCheckSchema = z
  .object({ explanation: explanationSchema, kind: z.literal("interaction") })
  .strict();

export const activityCheckSchema = z.discriminatedUnion("kind", [
  choiceCheckSchema,
  interactionCheckSchema,
  numericCheckSchema,
]);

export type ActivityCheck = z.infer<typeof activityCheckSchema>;
export type ActivityCheckKind = ActivityCheck["kind"];
export type ActivityVariable = z.infer<typeof variableSchema>;
export type ActivityOutput = z.infer<typeof outputSchema>;
export type ActivityTolerance = z.infer<typeof toleranceSchema>;
