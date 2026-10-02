import "server-only";
import { Output, generateText } from "ai";
import { getModelFamily } from "../../../_utils/model-family";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import {
  type LessonProblem,
  type LessonWritingContext,
  formatLessonPlan,
  formatLessonProblems,
} from "./format-lesson-plan";
import systemPrompt from "./lesson-writer.prompt.md";
import { type WrittenLesson, writtenLessonSchema } from "./written-lesson-schema";

/**
 * From the lesson-writer eval (4 specs in English and Portuguese, overview to
 * advanced, code checks then Astra judge, 26 Sep 2026): Sol 7.80 and Gemini
 * 3.8 Flash 7.74 at $43 and $30 per 1,000 lessons, but Gemini taught two wrong
 * ideas where Sol's errors were rare; after the prompt changes that eval
 * surfaced, Sol scored 8.54 and 8.66 on the cases it reran. On 27 Sep, on the
 * held-back redraft, sourced law and advanced physics cases, Sol scored 8.09
 * and Opus 5.5 7.72 at $43 and $154 per 1,000 lessons (Opus stated a made-up
 * product fact and misread the law). Fallbacks come from other families, so an
 * outage at one provider doesn't stop lessons.
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

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
 * blind spots. A private lesson Gemini drafted goes to Sol, the eval's best writer. The reviewer follows the
 * model that wrote the draft, so it stays from another family.
 */
export function getLessonRewriteModel(heldBackModels: readonly string[]): string {
  const families = new Set(heldBackModels.map((model) => getModelFamily(model)));

  return (
    [defaultModel, ...fallbackModels].find((model) => !families.has(getModelFamily(model))) ??
    defaultModel
  );
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
  const userPrompt = formatWriterPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: writtenLessonSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "lesson-writer",
  });

  const data: WrittenLesson = result.output;

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
