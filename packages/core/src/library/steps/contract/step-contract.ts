import { type StepKind } from "@zoonk/db";
import { z } from "zod";
import { activityContentSchema } from "../../activities/activity-templates";
import { challengeContentSchema } from "./challenge-content";
import {
  alphabetContentSchema,
  fillBlankContentSchema,
  matchColumnsContentSchema,
  multipleChoiceContentSchema,
} from "./language-exercises";
import { normalizeStepContentValue } from "./normalize-step-content";
import {
  checkContentSchema,
  explanationContentSchema,
  hookContentSchema,
  spokenAnswerContentSchema,
  summaryContentSchema,
  typedAnswerContentSchema,
  workedExampleContentSchema,
} from "./teaching-steps";

export type { ChartVisual, LessonVisual, TimelineVisual } from "@zoonk/ai/tasks/v2/visuals/schema";

export const STEP_CONTRACT_VERSION = 1;

const relationContentSchema = z.object({}).strict();

export const stepContentSchemas = {
  activity: activityContentSchema,
  alphabet: alphabetContentSchema,
  challenge: challengeContentSchema,
  check: checkContentSchema,
  explanation: explanationContentSchema,
  fillBlank: fillBlankContentSchema,
  hook: hookContentSchema,
  listening: relationContentSchema,
  matchColumns: matchColumnsContentSchema,
  multipleChoice: multipleChoiceContentSchema,
  reading: relationContentSchema,
  spokenAnswer: spokenAnswerContentSchema,
  summary: summaryContentSchema,
  translation: relationContentSchema,
  typedAnswer: typedAnswerContentSchema,
  vocabulary: relationContentSchema,
  workedExample: workedExampleContentSchema,
} as const satisfies Record<StepKind, z.ZodType>;

type StepContentSchemas = typeof stepContentSchemas;

export type StepContentByKind = { [TKind in StepKind]: z.output<StepContentSchemas[TKind]> };

const contentSchemaByKind: { [TKind in StepKind]: z.ZodType<StepContentByKind[TKind]> } =
  stepContentSchemas;

function parseNormalized<TSchema extends z.ZodType>(schema: TSchema, value: unknown) {
  return schema.safeParse(normalizeStepContentValue(value));
}

/** Returns a validation result; use `parseStepContent` when invalid stored content must throw. */
export function safeParseStepContent<TKind extends StepKind>(kind: TKind, content: unknown) {
  return parseNormalized(contentSchemaByKind[kind], content);
}

/** Throws on invalid stored content, which indicates corrupted data. */
export function parseStepContent<TKind extends StepKind>(
  kind: TKind,
  content: unknown,
): StepContentByKind[TKind] {
  const parsed = safeParseStepContent(kind, content);

  if (!parsed.success) {
    throw parsed.error;
  }

  return parsed.data;
}

export function describeContentIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
