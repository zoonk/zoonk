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
import { getScreenCharacterLimit } from "./screen-length";
import { fitWrittenBounds } from "./written-lesson-bounds";
import { type WrittenLesson, writtenLessonSchema } from "./written-lesson-schema";

const systemPrompt = rulesTemplate.replace("{{TYPED_QUESTION}}", () =>
  typedQuestionRules.trim().replaceAll(/^/gmu, "  "),
);

const lessonOutput = schemaInPrompt(writtenLessonSchema, { repair: fitWrittenBounds });

/**
 * `getLessonWriterModel` picks the first writer; each model falls back to the others, all from other
 * families, so an outage at one provider doesn't stop lessons. Argon hasn't run the current prompt.
 */
const WRITER_MODELS = [
  "openai/gpt-6.1-terra",
  "anthropic/claude-opus-5.5",
  "google/gemini-4-argon",
] as const;

const [defaultModel, sharedLessonModel] = WRITER_MODELS;

/**
 * Shared: on 15 lessons (8 Nov 2026), blind cross-family judges scored Opus 8.36 (EN 8.32, PT 8.41)
 * and Sonnet 8.06 (EN 7.93) at $179/1k against $125/1k, which a shared lesson spreads across its
 * readers. Personal: Terra scored 8.25 (EN 8.29, PT 8.20) at $21/1k; a blind Argon judge rated
 * Haiku 5.5 at high reasoning ($14/1k) about the same, but Terra led accuracy 9.20 to 8.27.
 */
export function getLessonWriterModel({ reuse }: { reuse: CallReuse }): string {
  return reuse === "personal" ? defaultModel : sharedLessonModel;
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

  const rules = selectPromptVariants({
    template: systemPrompt,
    variants: {
      exams: (params.exams?.length ?? 0) > 0,
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

  return rules.replaceAll(
    "{{SCREEN_CHARACTERS}}",
    String(getScreenCharacterLimit(params.language)),
  );
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
    fallbackModels: WRITER_MODELS,
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
