import "server-only";
import { Output, generateText } from "ai";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { type LessonWritingContext, formatLessonPlan } from "../lesson-writer/format-lesson-plan";
import { type LessonMap } from "../lesson-writer/written-lesson-schema";
import { getLessonCheckModels } from "./lesson-check-models";
import { lessonIssuesSchema, toLessonIssue } from "./lesson-issues";
import promptTemplate from "./lesson-quality-check.prompt.md";

export { type LessonQualityIssue } from "./lesson-issues";

type ReviewedLesson = { screens: { kind: string; content: unknown }[]; summary: LessonMap | null };

export type CheckLessonQualityParams = LessonWritingContext & {
  /** A script's first letters, shown as letter cards instead of planned screens. */
  alphabet?: boolean;
  lesson: ReviewedLesson;
  writerModel: string;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatLesson(lesson: ReviewedLesson): string {
  const screens = lesson.screens.map((screen, index) => ({ screen: index + 1, ...screen }));
  return JSON.stringify({ screens, summary: lesson.summary }, null, 1);
}

export async function checkLessonQuality(params: CheckLessonQualityParams) {
  const { analytics, lesson, reasoning, serviceTier, useFallback = true } = params;

  const models = getLessonCheckModels({
    kind: params.alphabet ? "alphabet" : "written",
    writerModel: params.writerModel,
  });

  const model = params.model ?? models.model;

  const providerOptions = buildProviderOptions({
    fallbackModels: models.fallbackModels,
    model,
    serviceTier,
    useFallback,
  });

  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: { alphabet: Boolean(params.alphabet) },
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
        output: Output.object({ schema: lessonIssuesSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "lesson-quality-check",
  });

  const issues = result.output.issues.map((issue) =>
    toLessonIssue({ issue, screenCount: lesson.screens.length }),
  );

  return { data: { issues }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
