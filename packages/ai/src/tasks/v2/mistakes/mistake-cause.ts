import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./mistake-cause.prompt.md";

const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

/**
 * Only the causes that need judgment. Time and guess are measured by code before this task runs,
 * because timing is a fact, not a reading of the answer.
 */
const mistakeCauseSchema = z.enum(["gap", "misread", "trap"]);

const schema = z.object({ cause: mistakeCauseSchema });

export type AmbiguousMistakeCause = z.infer<typeof mistakeCauseSchema>;
export type MistakeCauseSchema = z.infer<typeof schema>;

export type MistakeCauseInput = {
  correctAnswer: string;
  language: string;
  learnerAnswer: string;
  /** The misconception tag or reason of the option the learner chose; empty when there is none. */
  misconception: string;
  question: string;
  /** The learner's recent answers on the same skill, such as "3 of 5 right". */
  recentAccuracy: string;
};

export type MistakeCauseParams = MistakeCauseInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

/** Same field names in the generation prompt and the evaluation-model state. */
function toFields({
  correctAnswer,
  language,
  learnerAnswer,
  misconception,
  question,
  recentAccuracy,
}: MistakeCauseInput): Record<string, string> {
  return {
    CORRECT_ANSWER: correctAnswer,
    LANGUAGE: getPromptLanguageName({ language }),
    LEARNER_ANSWER: learnerAnswer,
    MISCONCEPTION: misconception || "none",
    QUESTION: question,
    RECENT_ACCURACY_ON_SKILL: recentAccuracy,
  };
}

/**
 * The same rules as an evaluation-model question, so the eval can compare Jev and other
 * evaluation models with the generation model on the same labels before production moves over.
 */
export const mistakeCauseClassifier = {
  instructions: systemPrompt,
  labels: {
    gap: "The learner doesn't know the idea yet or holds a wrong idea about it.",
    misread: "The learner knows the idea but answered a different question than the one asked.",
    trap: "The learner fell for a distractor built around a classic slip.",
  } satisfies Record<AmbiguousMistakeCause, string>,
  toInput: toFields,
};

/**
 * Names the cause of a wrong answer when its pattern is ambiguous: a learner with mixed results on
 * the skill, where only the answer itself tells a content gap from a misreading or a trap.
 */
export async function classifyMistakeCause({
  analytics,
  model = defaultModel,
  reasoning,
  useFallback = true,
  ...input
}: MistakeCauseParams) {
  const userPrompt = Object.entries(toFields(input))
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");

  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

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
    task: "mistake-cause",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
