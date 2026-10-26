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

/** A typed screen's question and key points follow the item bank's typed rules, under its bullet. */
const systemPrompt = rulesTemplate.replace("{{TYPED_QUESTION}}", () =>
  typedQuestionRules.trim().replaceAll(/^/gmu, "  "),
);

/**
 * From the lesson-writer eval (4 specs in English and Portuguese, overview to
 * advanced, code checks then Astra judge, 26 Sep 2026): Sol 7.80 and Gemini
 * 3.8 Flash 7.74 at $43 and $30 per 1,000 lessons, but Gemini taught two wrong
 * ideas where Sol's errors were rare; after the prompt changes that eval
 * surfaced, Sol scored 8.54 and 8.66 on the cases it reran. On 27 Sep, on the
 * held-back redraft, sourced law and advanced physics cases, Sol scored 8.09
 * and Opus 5.5 7.72 at $43 and $154 per 1,000 lessons (Opus stated a made-up
 * product fact and misread the law). Fallbacks come from other families, so an
 * outage at one provider doesn't stop lessons. Claude Haiku 5.5 scored 7.42 against Sol's 8.90 on 3
 * cases (7 Oct 2026), one draft not matching the schema. On 9 Oct, on 10 cases, the writer split
 * into small parts (the teaching screens, then each check, activity and explore at once) on GPT-6
 * Luna scored 7.84 (8.00 at high reasoning) against Sol's 8.71, at a ninth of the cost: 6 of its
 * 10 lessons taught something wrong, against 1 of Sol's. Sol writes every lesson, private ones too.
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

/**
 * Gemini 3.8 Flash, a last draft's writer when Sol's and Opus's families wrote the held-back ones,
 * rejects the writer's schema as too large (9 Oct 2026), so its drafts fall back to Sol, the eval's
 * best writer, before Opus at about six times Sol's cost.
 */
const geminiFallbackModels = [defaultModel, "anthropic/claude-opus-5.5"] as const;

function getFallbackModels(model: string): readonly string[] {
  return getModelFamily(model) === "google" ? geminiFallbackModels : fallbackModels;
}

export type WriteLessonDraftParams = LessonWritingContext & {
  /** What held earlier drafts of this lesson back, so the new draft doesn't repeat it. */
  heldBackProblems?: readonly LessonProblem[];
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/**
 * The writer of a lesson's last draft, once drafts were held back twice: the first model of the
 * writer's own chain (Sol, then Opus 5.5, then Gemini 3.8 Flash) from a family that wrote none of
 * them. A shared lesson Sol drafted goes to Opus 5.5 rather than Gemini, which taught wrong ideas
 * in the writer eval: a draft still held back after its fix pass is held back for being wrong,
 * and Opus caught every planted mistake in the reviewer eval. As a writer it scored below Sol
 * (7.72 against 8.09 on three cases), which a lesson Sol failed twice trades for another family's
 * blind spots. The reviewer follows the model that wrote the draft, so it stays from another family.
 */
export function getLessonRewriteModel(heldBackModels: readonly string[]): string {
  const families = new Set(heldBackModels.map((model) => getModelFamily(model)));

  return (
    [defaultModel, ...fallbackModels].find((model) => !families.has(getModelFamily(model))) ??
    defaultModel
  );
}

/** The activity template of "Spot the AI's mistake" (and of every other wrong step to find). */
const FIND_ERROR_TEMPLATE = "findError";

/**
 * The rules, keeping in place only the variants this lesson is (a step to find the mistake in,
 * built from the learner's material or official sources, written for exams, a setup lesson). A
 * lesson never reads the others' rules, so its prompt (and version) never carries them, and a
 * variant's lesson reads its rules where they always were.
 */
function buildSystemPrompt(params: WriteLessonDraftParams): string {
  return selectPromptVariants({
    template: systemPrompt,
    variants: {
      exams: (params.exams?.length ?? 0) > 0,
      material: Boolean(params.material),
      setup: Boolean(params.setup),
      sources: Boolean(params.sources),
      spotAiMistake: params.spec.screens.some(
        (screen) => screen.activityTemplate === FIND_ERROR_TEMPLATE,
      ),
    },
  });
}

/** The lesson plan, and what held earlier drafts back when there were any. */
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

/**
 * Writes a lesson from its spec: a hook first, the idea in small screens, a
 * check every 2 or 3 screens with a reason on every option, worked examples
 * for hard skills, calculations as data, activities only where the spec put
 * them, an application in a real situation and the summary card. Callers run
 * the lesson checks in `@zoonk/core` and send what fails to `fixLessonDraft`.
 */
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
