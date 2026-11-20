import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./check-recall-overlap.prompt.md";
import { type GeneratedItem } from "./item-schemas";

/**
 * On 5 labeled cases (17 candidates: rewordings, negations, renamed cases and same-skill questions
 * that stay new; 3 runs each, 20 Nov 2026), Luna caught every repeat and kept every new question at
 * $0.35/1k and 5.0 s p50. Haiku 5.5 (9.93, $0.68/1k) once dropped a reversed percentage case, and
 * Gemini 3.5 Flash Lite (9.87, $0.84/1k) twice dropped a new judicial review question.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["anthropic/claude-haiku-5.5"] as const;

/** What a learner saw: the question as shown and its answer, when it has one. */
export type RecallQuestion = { question: string; answer: string | null };

export type CheckRecallOverlapParams = {
  skill: { name: string; description: string };
  /** New questions, before they're stored. */
  candidates: readonly GeneratedItem[];
  /** The skill's questions a learner can already have met: bank questions and lesson question screens. */
  earlier: readonly RecallQuestion[];
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** Indexes are positions in `candidates` and `earlier`. */
export type RecallOverlap = { candidate: number; earlier: number; reason: string };

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the comparison before the verdict. */
const schema = z.object({
  checks: z.array(
    z.object({
      candidate: z.number().int(),
      reason: z.string(),
      repeats: z.number().int().nullable(),
    }),
  ),
});
/* oxlint-enable eslint/sort-keys */

function lines(values: readonly (string | null | undefined)[]): string {
  return values.filter(Boolean).join("\n");
}

/** The question as a learner reads it, and its key, from any item format. */
export function toRecallQuestion(item: GeneratedItem): RecallQuestion {
  switch (item.format) {
    case "trueFalse":
      return {
        answer: item.isTrue ? "true" : "false",
        question: lines([item.context, item.statement]),
      };
    case "multipleChoice":
      return {
        answer: item.options
          .flatMap((option) => (option.isCorrect ? [option.text] : []))
          .join("; "),
        question: lines([
          item.context,
          item.question,
          ...item.options.map((option) => `- ${option.text}`),
        ]),
      };
    case "typed":
    case "spoken":
      return { answer: item.sampleAnswer, question: lines([item.context, item.question]) };
    case "essay":
      return { answer: null, question: lines([item.context, item.question]) };
    case "numeric":
      return {
        answer: `${item.math.answer}${item.math.unit ? ` ${item.math.unit}` : ""}`,
        question: lines([item.context, item.question]),
      };
    case "matchPairs":
      return {
        answer: item.pairs.map((pair) => `${pair.left} = ${pair.right}`).join("; "),
        question: item.question,
      };
    case "order":
      return { answer: item.steps.join(" > "), question: item.question };
    default:
      throw new Error("Unknown item format.");
  }
}

function formatQuestions(questions: readonly RecallQuestion[]): string {
  return questions
    .map(
      (entry, index) =>
        `${index + 1}. ${entry.question.replaceAll(/\s+/gu, " ").trim()}${entry.answer ? `\n   Answer: ${entry.answer.replaceAll(/\s+/gu, " ").trim()}` : ""}`,
    )
    .join("\n");
}

/**
 * Finds the new questions a learner could answer by remembering an earlier one (the same statement
 * or case reworded, negated or renamed), while the same rule asked in a case of its own stays new.
 * A candidate the model skipped counts as no repeat. Callers skip the call when either list is empty.
 */
export async function checkRecallOverlap(params: CheckRecallOverlapParams) {
  const {
    analytics,
    candidates,
    earlier,
    model = defaultModel,
    reasoning,
    serviceTier,
    skill,
    useFallback = true,
  } = params;

  /* oxlint-disable eslint/sort-keys -- The model reads the skill and what the learner met before the new questions. */
  const userPrompt = formatUntrustedInput({
    SKILL: `${skill.name}: ${skill.description}`,
    EARLIER: formatQuestions(earlier),
    CANDIDATES: formatQuestions(candidates.map((item) => toRecallQuestion(item))),
  });
  /* oxlint-enable eslint/sort-keys */

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoning,
    serviceTier,
    useFallback,
  });

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
    libraryInput: true,
    systemPrompt,
    task: "check-recall-overlap",
  });

  const repeats = result.output.checks.flatMap((check): RecallOverlap[] => {
    const candidate = check.candidate - 1;
    const repeated = (check.repeats ?? 0) - 1;
    const known = candidates[candidate] !== undefined && earlier[repeated] !== undefined;
    return known ? [{ candidate, earlier: repeated, reason: check.reason }] : [];
  });

  return { data: { repeats }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
