import { z } from "zod";
import { promptSchema, stepImageRequestSchema } from "../steps/contract/content-schemas";
import { type ActivityExpectedAnswer } from "./activity-expected-answer";
import {
  type ActivityCheckKind,
  activityCheckSchema,
  activityDataSchema,
} from "./activity-schemas";
import { type ExpressionRange } from "./expression/sample-expression";

export type ActivityIssueCode =
  | "answerMismatch"
  | "checkNotAllowed"
  | "formulaFails"
  | "inconsistentFields"
  | "invalidSchema"
  | "labelTooLong"
  | "missingCheck"
  | "missingDataSource"
  | "missingInteraction"
  | "programFails"
  | "unknownAsset"
  | "unknownTemplate";

/** One reason an activity can't be published, written for the fix step of the lesson writer. */
export type ActivityIssue = { code: ActivityIssueCode; message: string; path: string };

/** A check's slider positions and the output it reads, resolved from the check. */
export type ActivityCheckTarget = {
  inputs: Readonly<Record<string, number>>;
  output: string | null;
};

/** A formula the validator samples across the given variable ranges. */
export type ActivityFormula = {
  expression: string;
  path: string;
  ranges: readonly ExpressionRange[];
};

type ActivityTemplateHooks<TFields> = {
  /** The end state an `interaction` check expects. */
  expected?: (fields: TFields) => ActivityExpectedAnswer | null;
  /** Formulas that must evaluate across their whole range. */
  formulas?: (fields: TFields) => ActivityFormula[];
  /** The number a `numeric` check (or a `choice` check with option values) must match. */
  value?: (fields: TFields, target: ActivityCheckTarget) => number | null;
  /** Template rules: consistent data, and something real to move, order or build. */
  verify?: (fields: TFields) => ActivityIssue[];
};

type ActivityTemplateDefinition<
  TId extends string,
  TFields extends z.ZodType,
> = ActivityTemplateHooks<z.output<TFields>> & {
  /** Check kinds this template supports. Every one is tied to the interaction. */
  checks: readonly ActivityCheckKind[];
  /** A `choice` check must give every option a `value`, because the answer is only a number. */
  choicesNeedValues?: boolean;
  /** What the template teaches and what the writer fills, for the writer's prompt. */
  description: string;
  fields: TFields;
  id: TId;
  /** Shows data, so it must cite a source or be labeled as an example. */
  needsData: boolean;
};

/**
 * The activity envelope. `image` is a picture the case needs to be seen (the leaf a decision
 * tree names), asked for like a teaching screen's and drawn by the lesson image pipeline.
 */
function buildContentSchema<TId extends string, TFields extends z.ZodType>(
  id: TId,
  fields: TFields,
) {
  return z
    .object({
      check: activityCheckSchema,
      data: activityDataSchema.optional(),
      fields,
      image: stepImageRequestSchema.optional(),
      prompt: promptSchema,
      template: z.literal(id),
    })
    .strict();
}

/**
 * Declares a template as data: its field schema, the checks it allows and how code computes them. The
 * hooks receive typed fields; the returned template exposes them for any content, so the
 * validator and answer checker can run every template through one code path.
 */
export function defineActivityTemplate<const TId extends string, TFields extends z.ZodType>(
  definition: ActivityTemplateDefinition<TId, TFields>,
) {
  const { expected, fields, formulas, value, verify, ...meta } = definition;

  function parseFields(input: unknown): z.output<TFields> | null {
    const parsed = fields.safeParse(input);
    return parsed.success ? parsed.data : null;
  }

  return {
    ...meta,
    computeExpected: (input: unknown): ActivityExpectedAnswer | null => {
      const parsed = parseFields(input);
      return parsed === null || !expected ? null : expected(parsed);
    },
    computeValue: (input: unknown, target: ActivityCheckTarget): number | null => {
      const parsed = parseFields(input);
      return parsed === null || !value ? null : value(parsed, target);
    },
    content: buildContentSchema(definition.id, fields),
    fields,
    listFormulas: (input: unknown): ActivityFormula[] => {
      const parsed = parseFields(input);
      return parsed === null || !formulas ? [] : formulas(parsed);
    },
    verifyFields: (input: unknown): ActivityIssue[] => {
      const parsed = parseFields(input);
      return parsed === null || !verify ? [] : verify(parsed);
    },
  };
}

/** A template with its hooks erased to `unknown` fields, so every template fits one registry. */
export type ActivityTemplate = {
  checks: readonly ActivityCheckKind[];
  choicesNeedValues?: boolean;
  computeExpected: (fields: unknown) => ActivityExpectedAnswer | null;
  computeValue: (fields: unknown, target: ActivityCheckTarget) => number | null;
  content: z.ZodType;
  description: string;
  fields: z.ZodType;
  id: string;
  listFormulas: (fields: unknown) => ActivityFormula[];
  needsData: boolean;
  verifyFields: (fields: unknown) => ActivityIssue[];
};
