import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { type LessonWritingContext, formatLessonPlan } from "../lesson-writer/format-lesson-plan";
import { getLessonCheckModels } from "./lesson-check-models";
import systemPrompt from "./lesson-quality-check.prompt.md";

const QUALITY_ISSUE_KINDS = [
  "incorrect",
  "jargon",
  "unclear",
  "filler",
  "level",
  "decorativeActivity",
  "weakCheck",
  "scope",
] as const;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: where and what before how to fix it. */
const schema = z.object({
  issues: z.array(
    z.object({
      screen: z.number().int().nullable(),
      kind: z.enum(QUALITY_ISSUE_KINDS),
      severity: z.enum(["blocking", "minor"]),
      problem: z.string(),
      fix: z.string(),
    }),
  ),
});
/* oxlint-enable eslint/sort-keys */

export type LessonQualityIssueKind = (typeof QUALITY_ISSUE_KINDS)[number];

/** A problem the reviewer found. `screen` is a 0-based index, or null for the whole lesson. */
export type LessonQualityIssue = z.infer<typeof schema>["issues"][number];

/** The lesson as learners will see it: each screen's stored kind and content, and the summary card. */
type ReviewedLesson = { screens: { kind: string; content: unknown }[]; summary: string[] };

export type CheckLessonQualityParams = LessonWritingContext & {
  lesson: ReviewedLesson;
  /** The model that wrote the lesson, so the reviewer comes from another family. */
  writerModel: string;
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatLesson(lesson: ReviewedLesson): string {
  const screens = lesson.screens.map((screen, index) => ({ screen: index + 1, ...screen }));
  return JSON.stringify({ screens, summary: lesson.summary }, null, 1);
}

/** Screen numbers are 1-based for the model; anything outside the lesson becomes lesson-wide. */
function toIssue({
  issue,
  screenCount,
}: {
  issue: LessonQualityIssue;
  screenCount: number;
}): LessonQualityIssue {
  const index = issue.screen === null ? null : issue.screen - 1;
  return { ...issue, screen: index !== null && index >= 0 && index < screenCount ? index : null };
}

/**
 * The judgment half of the quality gate: a reasoning model from a different
 * family than the writer reads the lesson as a learner and as an expert, and
 * reports wrong facts or answers, jargon before it's explained, unclear steps,
 * filler, level misfits, decorative activities and weak checks. A lesson passes
 * when no issue is `blocking`.
 */
export async function checkLessonQuality(params: CheckLessonQualityParams) {
  const { analytics, lesson, reasoning, serviceTier, useFallback = true } = params;
  const models = getLessonCheckModels(params.writerModel);
  const model = params.model ?? models.model;

  const providerOptions = buildProviderOptions({
    fallbackModels: models.fallbackModels.filter((candidate) => candidate !== model),
    model,
    serviceTier,
    useFallback,
  });

  const userPrompt = `${formatLessonPlan(params)}
LESSON:
${formatLesson(lesson)}
`;

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "lesson-quality-check",
  });

  const issues = result.output.issues.map((issue) =>
    toIssue({ issue, screenCount: lesson.screens.length }),
  );

  return { data: { issues }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
