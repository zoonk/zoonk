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

/** The chart or timeline a screen or question shows, drawn from its data. */
export type { ChartVisual, LessonVisual, TimelineVisual } from "@zoonk/ai/tasks/v2/visuals/schema";

/** The contract version stored in `Step.contractVersion` and `StepVariant.contractVersion`. */
export const STEP_CONTRACT_VERSION = 1;

/**
 * Vocabulary, reading, listening and translation screens read their word or sentence through the
 * step's `wordId` or `sentenceId`, so their content carries nothing else.
 */
const relationContentSchema = z.object({}).strict();

/** One content schema per `StepKind`. */
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

/** The same schemas typed per kind, so a generic `kind` narrows the parsed content. */
const contentSchemaByKind: { [TKind in StepKind]: z.ZodType<StepContentByKind[TKind]> } =
  stepContentSchemas;

/**
 * Generated JSON sometimes has a malformed backslash escape where LaTeX meant `\`, and NULs that
 * Postgres JSONB can't store. Both are repaired in string values before validation.
 */
function parseNormalized<TSchema extends z.ZodType>(schema: TSchema, value: unknown) {
  return schema.safeParse(normalizeStepContentValue(value));
}

/** Validates and repairs a step's content for its kind; returns zod's result without throwing. */
export function safeParseStepContent<TKind extends StepKind>(kind: TKind, content: unknown) {
  return parseNormalized(contentSchemaByKind[kind], content);
}

/**
 * Reads stored step content. Content is only written after it validates, so a failure means
 * corrupted data and throws.
 */
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

/** A content error as one line per issue, prefixed with its path, for the writer's fix step. */
export function describeContentIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
