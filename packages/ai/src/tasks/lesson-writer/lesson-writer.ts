import "server-only";
import { generateText } from "ai";
import { schemaInPrompt } from "../../_utils/schema-in-prompt";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import {
  type CallReuse,
  type Reasoning,
  type ServedSpeed,
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
import { getScreenCharacterTarget } from "./screen-length";
import { fitWrittenBounds } from "./written-lesson-bounds";
import { type WrittenLesson, writtenLessonSchema } from "./written-lesson-schema";

const systemPrompt = rulesTemplate.replace("{{TYPED_QUESTION}}", () =>
  typedQuestionRules.trim().replaceAll(/^/gmu, "  "),
);

const lessonOutput = schemaInPrompt(writtenLessonSchema, { repair: fitWrittenBounds });

/**
 * Each writer falls back across families. On four current-prompt lessons (11 Nov 2026), shared
 * Opus scored 8.63 at $155/1k versus Fable's 8.53 at $704/1k; Carbon scored 7.67 at $156/1k
 * versus Argon's 7.97 at $38/1k, so neither new model justified changing the chain.
 */
export const WRITER_MODELS = [
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
  speed?: ServedSpeed;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

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
    String(getScreenCharacterTarget(params.language)),
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
  const { analytics, model = defaultModel, reasoning, serviceTier, speed } = params;
  const { useFallback = true } = params;
  const instructions = `${buildSystemPrompt(params)}\n\n${lessonOutput.outputRules}`;
  const userPrompt = formatWriterPrompt(params);

  const providerOptions = buildProviderOptions({
    fallbackModels: WRITER_MODELS,
    model,
    serviceTier,
    speed,
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
