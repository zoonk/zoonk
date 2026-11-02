import { z } from "zod";
import { promptSchema, stepImageRequestSchema } from "../steps/contract/content-schemas";
import { type ActivityExpectedAnswer } from "./activity-expected-answer";
import {
  type ActivityCheckKind,
  type ActivityTolerance,
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

export type ActivityIssue = { code: ActivityIssueCode; message: string; path: string };

export type ActivityCheckTarget = {
  inputs: Readonly<Record<string, number>>;
  output: string | null;
};

export type ActivityFormula = {
  expression: string;
  path: string;
  ranges: readonly ExpressionRange[];
};

type ActivityTemplateHooks<TFields> = {
  expected?: (fields: TFields) => ActivityExpectedAnswer | null;
  formulas?: (fields: TFields) => ActivityFormula[];
  value?: (fields: TFields, target: ActivityCheckTarget) => number | null;
  verify?: (fields: TFields) => ActivityIssue[];
};

type FieldsRule<TFields> = boolean | ((fields: TFields) => boolean);

type ActivityTemplateDefinition<
  TId extends string,
  TFields extends z.ZodType,
> = ActivityTemplateHooks<z.output<TFields>> & {
  checks: readonly ActivityCheckKind[];
  checksFor?: (fields: z.output<TFields>) => readonly ActivityCheckKind[];
  choicesNeedValues?: FieldsRule<z.output<TFields>>;
  description: string;
  fields: TFields;
  id: TId;
  minTolerance?: ActivityTolerance;
  needsData: FieldsRule<z.output<TFields>>;
};

function applyRule<TFields>(rule: FieldsRule<TFields>, fields: TFields | null): boolean {
  if (typeof rule === "boolean") {
    return rule;
  }

  return fields !== null && rule(fields);
}

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

function buildExploreSchema<TId extends string, TFields extends z.ZodType>(
  id: TId,
  fields: TFields,
) {
  return z
    .object({ data: activityDataSchema.optional(), fields, template: z.literal(id) })
    .strict();
}

export function defineActivityTemplate<const TId extends string, TFields extends z.ZodType>(
  definition: ActivityTemplateDefinition<TId, TFields>,
) {
  const {
    checksFor,
    choicesNeedValues = false,
    expected,
    fields,
    formulas,
    needsData,
    value,
    verify,
    ...meta
  } = definition;

  function parseFields(input: unknown): z.output<TFields> | null {
    const parsed = fields.safeParse(input);
    return parsed.success ? parsed.data : null;
  }

  return {
    ...meta,
    allowedChecks: (input: unknown): readonly ActivityCheckKind[] => {
      const parsed = parseFields(input);
      return parsed === null || !checksFor ? meta.checks : checksFor(parsed);
    },
    choicesNeedValues: (input: unknown): boolean =>
      applyRule(choicesNeedValues, parseFields(input)),
    computeExpected: (input: unknown): ActivityExpectedAnswer | null => {
      const parsed = parseFields(input);
      return parsed === null || !expected ? null : expected(parsed);
    },
    computeValue: (input: unknown, target: ActivityCheckTarget): number | null => {
      const parsed = parseFields(input);
      return parsed === null || !value ? null : value(parsed, target);
    },
    content: buildContentSchema(definition.id, fields),
    explore: buildExploreSchema(definition.id, fields),
    fields,
    listFormulas: (input: unknown): ActivityFormula[] => {
      const parsed = parseFields(input);
      return parsed === null || !formulas ? [] : formulas(parsed);
    },
    mayShowData: needsData !== false,
    showsData: (input: unknown): boolean => applyRule(needsData, parseFields(input)),
    verifyFields: (input: unknown): ActivityIssue[] => {
      const parsed = parseFields(input);
      return parsed === null || !verify ? [] : verify(parsed);
    },
  };
}

export type ActivityTemplate = {
  allowedChecks: (fields: unknown) => readonly ActivityCheckKind[];
  checks: readonly ActivityCheckKind[];
  choicesNeedValues: (fields: unknown) => boolean;
  computeExpected: (fields: unknown) => ActivityExpectedAnswer | null;
  computeValue: (fields: unknown, target: ActivityCheckTarget) => number | null;
  content: z.ZodType;
  description: string;
  explore: z.ZodType;
  fields: z.ZodType;
  id: string;
  listFormulas: (fields: unknown) => ActivityFormula[];
  mayShowData: boolean;
  minTolerance?: ActivityTolerance;
  showsData: (fields: unknown) => boolean;
  verifyFields: (fields: unknown) => ActivityIssue[];
};
