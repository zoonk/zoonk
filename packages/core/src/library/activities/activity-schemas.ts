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

const EXPRESSION_MAX_LENGTH = 300;
const CODE_MAX_LENGTH = 2000;
const UNIT_MAX_LENGTH = 16;
const SLUG_MAX_LENGTH = 60;
const MAX_CHECK_INPUTS = 6;

/** A formula in the safe expression language (see `expression/parse-expression.ts`). */
export const expressionSchema = z.string().min(1).max(EXPRESSION_MAX_LENGTH);

/** Variable names formulas can reference: letters, digits and `_`, starting with a letter or `_`. */
export const identifierSchema = z.string().regex(/^[A-Z_a-z]\w{0,31}$/u);

export const unitSchema = z.string().min(1).max(UNIT_MAX_LENGTH);
export const codeSchema = z.string().min(1).max(CODE_MAX_LENGTH);

/** Ids of checked assets such as diagrams and base maps, like "human-heart". */
export const slugSchema = z
  .string()
  .max(SLUG_MAX_LENGTH)
  .regex(/^[\da-z]+(?:-[\da-z]+)*$/u);

/** A slider: what the learner moves, its range and where it starts. */
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

/** A value code computes from the variables and shows as the learner moves them. */
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

/** A named number, used instead of JSON maps so generated output stays a plain list. */
export const namedValueSchema = z.object({ name: identifierSchema, value: z.number() }).strict();

/**
 * Real data carries its source; anything made up for the lesson says so. Never both, never
 * neither, which is how "charts of made-up data" can't pass as facts.
 */
export const activityDataSchema = z.union([
  z.object({ isExample: z.literal(true) }).strict(),
  z.object({ source: citationSchema }).strict(),
]);

/**
 * Where a check's computed answer comes from: slider positions (`inputs`) and which output to
 * read (`output`). Templates document what each one means for them.
 */
const checkTargetShape = {
  inputs: z.array(namedValueSchema).max(MAX_CHECK_INPUTS).optional(),
  output: idSchema.optional(),
};

/** `value` lets code verify a choice: the option closest to the computed answer must be correct. */
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

/** The interaction's end state is the answer, computed by code from the fields. */
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
