import "server-only";
import { Output, generateText } from "ai";
import { getModelFamily } from "../../../_utils/model-family";
import { acceptOmittedNulls } from "../../../_utils/omitted-nulls";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import typedQuestionRules from "../items/item-rules/typed-question.prompt.md";
import {
  type LessonProblem,
  type LessonWritingContext,
  formatLessonPlan,
  formatLessonProblems,
} from "./format-lesson-plan";
import rulesTemplate from "./lesson-writer.prompt.md";
import { type WrittenLesson, writtenLessonSchema } from "./written-lesson-schema";

const systemPrompt = rulesTemplate.replace("{{TYPED_QUESTION}}", () =>
  typedQuestionRules.trim().replaceAll(/^/gmu, "  "),
);

/**
 * Sol taught fewer wrong ideas than Gemini and Opus on the lesson-writer eval (26 Sep 2026), and
 * split into parts, Luna taught something wrong in 6 of 10 lessons against Sol's 1 (9 Oct 2026).
 * Fallbacks come from other families, so an outage at one provider doesn't stop lessons.
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

/**
 * Gemini 3.8 Flash rejects the writer's schema as too large (9 Oct 2026), so it falls back to Sol.
 */
const geminiFallbackModels = [defaultModel, "anthropic/claude-opus-5.5"] as const;

function getFallbackModels(model: string): readonly string[] {
  return getModelFamily(model) === "google" ? geminiFallbackModels : fallbackModels;
}

export type WriteLessonDraftParams = LessonWritingContext & {
  /** So the new draft doesn't repeat what held earlier ones back. */
  heldBackProblems?: readonly LessonProblem[];
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * The first model of the writer's chain from a family that wrote none of the held-back drafts; a
 * shared lesson Sol drafted goes to Opus rather than Gemini, which taught wrong ideas in the writer
 * eval. The reviewer follows the writer, so it stays from another family.
 */
export function getLessonRewriteModel(heldBackModels: readonly string[]): string {
  const families = new Set(heldBackModels.map((model) => getModelFamily(model)));

  return (
    [defaultModel, ...fallbackModels].find((model) => !families.has(getModelFamily(model))) ??
    defaultModel
  );
}

const FIND_ERROR_TEMPLATE = "findError";

function buildSystemPrompt(params: WriteLessonDraftParams): string {
  return selectPromptVariants({
    template: systemPrompt,
    variants: {
      exams: (params.exams?.length ?? 0) > 0,
      material: Boolean(params.material),
      setup: Boolean(params.setup),
      shortAnswers: Boolean(params.shortAnswers),
      sources: Boolean(params.sources),
      spotAiMistake: params.spec.screens.some(
        (screen) => screen.activityTemplate === FIND_ERROR_TEMPLATE,
      ),
    },
  });
}

function formatWriterPrompt(params: WriteLessonDraftParams): string {
  const plan = formatLessonPlan(params);
  const problems = params.heldBackProblems ?? [];

  if (problems.length === 0) {
    return plan;
  }

  return `${plan}
HELD_BACK_DRAFTS:
Earlier drafts of this lesson were held back for these problems (screen numbers refer to the draft that had them). Write a new draft that has none of them.
${formatLessonProblems(problems)}
`;
}

/** Callers run the lesson checks in `@zoonk/core` and send what fails to `fixLessonDraft`. */
export async function writeLessonDraft(params: WriteLessonDraftParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const instructions = buildSystemPrompt(params);
  const userPrompt = formatWriterPrompt(params);

  const providerOptions = buildProviderOptions({
    fallbackModels: getFallbackModels(model),
    model,
    serviceTier,
    useFallback,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions,
        model,
        output: Output.object({ schema: acceptOmittedNulls(writtenLessonSchema) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt: instructions,
    task: "lesson-writer",
  });

  const data: WrittenLesson = result.output;

  return { data, provenance, systemPrompt: instructions, usage: result.usage, userPrompt };
}
