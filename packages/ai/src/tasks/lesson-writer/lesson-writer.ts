import "server-only";
import { generateText } from "ai";
import { getModelFamily } from "../../_utils/model-family";
import { schemaInPrompt } from "../../_utils/schema-in-prompt";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import {
  type CallReuse,
  type Reasoning,
  type ServiceTier,
  buildProviderOptions,
} from "../../provider-options";
import { readsNoviceRules } from "../_utils/novice-rules";
import { selectPromptVariants } from "../_utils/prompt-variants";
import typedQuestionRules from "../items/item-rules/typed-question.prompt.md";
import {
  type LessonProblem,
  type LessonWritingContext,
  formatLessonPlan,
  formatLessonProblems,
} from "./format-lesson-plan";
import { normalizeLessonMap } from "./lesson-map";
import rulesTemplate from "./lesson-writer.prompt.md";
import { fitWrittenBounds } from "./written-lesson-bounds";
import { type WrittenLesson, writtenLessonSchema } from "./written-lesson-schema";

const systemPrompt = rulesTemplate.replace("{{TYPED_QUESTION}}", () =>
  typedQuestionRules.trim().replaceAll(/^/gmu, "  "),
);

const lessonOutput = schemaInPrompt(writtenLessonSchema, { repair: fitWrittenBounds });

/**
 * In a benchmark where no judge scored its own family (3 Nov 2026, 24 cases), Sonnet 5.5 matched or
 * beat Opus 5.5, with fewer factual slips, at two thirds of its cost, and both wrote more engaging
 * lessons than Terra at 7 and 10 times its cost and about twice its time. `getLessonWriterModel`
 * picks the first writer; each model falls back to the others, all from other families, so an
 * outage at one provider doesn't stop lessons.
 */
const WRITER_MODELS = [
  "openai/gpt-6.1-terra",
  "anthropic/claude-sonnet-5.5",
  "google/gemini-4-argon",
] as const;

const [defaultModel, sharedLessonModel] = WRITER_MODELS;

/**
 * Sonnet 5.5 writes a lesson other learners will read: it beat Terra on held-out cases by 1.55
 * points, 2.25 on "Engaging, not a textbook" (3 Nov 2026), at about 7 times the cost, which a shared
 * lesson spreads across its readers. A lesson for one learner stays with Terra.
 */
export function getLessonWriterModel({ reuse }: { reuse: CallReuse }): string {
  return reuse === "personal" ? defaultModel : sharedLessonModel;
}

function getFallbackModels(model: string): string[] {
  return WRITER_MODELS.filter((candidate) => candidate !== model);
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
 * The first model of the writer's chain from a family that wrote none of the held-back drafts. The
 * reviewer follows the writer, so it stays from another family.
 */
export function getLessonRewriteModel(heldBackModels: readonly string[]): string {
  const families = new Set(heldBackModels.map((model) => getModelFamily(model)));

  return WRITER_MODELS.find((model) => !families.has(getModelFamily(model))) ?? defaultModel;
}

const FIND_ERROR_TEMPLATE = "findError";

function buildSystemPrompt(params: WriteLessonDraftParams): string {
  const novice = readsNoviceRules(params);

  return selectPromptVariants({
    template: systemPrompt,
    variants: {
      exams: (params.exams?.length ?? 0) > 0,
      experienced: !novice,
      material: Boolean(params.material),
      novice,
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
  const instructions = `${buildSystemPrompt(params)}\n\n${lessonOutput.outputRules}`;
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
        output: lessonOutput.output,
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt: instructions,
    task: "lesson-writer",
  });

  const data: WrittenLesson = {
    ...result.output,
    summary: normalizeLessonMap(result.output.summary),
  };

  return { data, provenance, systemPrompt: instructions, usage: result.usage, userPrompt };
}
