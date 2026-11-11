import "server-only";
import { Output, generateText } from "ai";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getLessonCheckModels } from "../quality/lesson-check-models";
import { lessonIssuesSchema, toLessonIssue } from "../quality/lesson-issues";
import { type LanguageLessonInputs, formatLanguageLessonInputs } from "./language-lesson";
import systemPrompt from "./language-lesson-check.prompt.md";

export type CheckLanguageLessonParams = LanguageLessonInputs & {
  /** Every screen as learners see it, in order. */
  screens: readonly { kind: string; content: unknown }[];
  writerModel: string;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

export async function checkLanguageLesson(params: CheckLanguageLessonParams) {
  const { analytics, reasoning, screens, serviceTier, useFallback = true } = params;
  const reviewers = getLessonCheckModels({ kind: "language", writerModel: params.writerModel });
  const model = params.model ?? reviewers.model;

  const providerOptions = buildProviderOptions({
    fallbackModels: reviewers.fallbackModels,
    model,
    serviceTier,
    useFallback,
  });

  const numbered = screens.map((screen, index) => ({ screen: index + 1, ...screen }));

  const userPrompt = `${formatLanguageLessonInputs(params)}
SCREENS:
${JSON.stringify(numbered, null, 1)}
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
    task: "language-lesson-check",
  });

  const issues = result.output.issues.map((issue) =>
    toLessonIssue({ issue, screenCount: screens.length }),
  );

  return { data: { issues }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
