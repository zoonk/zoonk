import "server-only";
import { Output, generateText } from "ai";
import { pickReviewers } from "../../_utils/model-family";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { lessonIssuesSchema, toLessonIssue } from "../quality/lesson-issues";
import { type LanguageLessonInputs, formatLanguageLessonInputs } from "./language-lesson";
import systemPrompt from "./language-lesson-check.prompt.md";

/**
 * On 10 slips learners met (#2506, #2414, #2509) and 4 clean lessons, 3 runs each (11 Nov 2026),
 * Sonnet 5.5 caught 25 of 30 slips on their screen at $18 per 1k reviews, but caught the gendered
 * line in only 1 of 3 runs; Gemini 3.8 Flash caught 27, the gendered line every time, at $20 per 1k
 * with an 88 s p95. Each blocked 2 of the 12 clean runs; Sonnet's were wrong open-vowel findings,
 * which the writer usually declines. Haiku 5.5 and Gemini 3.5 Flash-Lite missed a third of the
 * slips. Luna, Terra and Sol blocked 9 to 12 of the 12 clean runs over respelling conventions, so
 * no OpenAI model reviews these lessons.
 */
const REVIEWERS = ["anthropic/claude-sonnet-5.5", "google/gemini-3.8-flash"] as const;

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
  const reviewers = pickReviewers({ reviewers: REVIEWERS, writerModel: params.writerModel });
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
