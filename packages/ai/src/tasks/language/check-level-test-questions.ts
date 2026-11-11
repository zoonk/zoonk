import "server-only";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { getLanguagePromptContext } from "../_utils/prompt-language";
import systemPrompt from "./check-level-test-questions.prompt.md";

/**
 * A missed flaw reaches every learner of the pair. On the eval's 15 levels (11 Nov 2026, each run 3
 * times, 18 planted flaws), Terra at low reasoning and Gemini 4 Carbon at low caught all 18 and
 * kept all 129 good questions; Terra answers in 4.8 s p50 at $2.69 per 1,000 checks, Carbon in
 * 7.2 s at $6.46. Gemini 3.8 Flash missed the café answer every time, Luna missed the floors, and
 * Haiku and Sonnet (also at high) missed several. The writer is Anthropic's, so the check isn't.
 */
const defaultModel = "openai/gpt-6.1-terra";
const defaultReasoning: Reasoning = "low";
const fallbackModels = ["google/gemini-4-carbon"] as const;

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
const LEAKS = ["form", "knowledge", "language"] as const;

/** The levels whose questions take reading between the lines; the writer's prompt says the same. */
const IMPLIED_LEVELS: ReadonlySet<CefrLevel> = new Set(["B2", "C1"]);

type Leak = (typeof LEAKS)[number];

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the work before the answer it leads to. */
const schema = z.object({
  answers: z.array(
    z.object({
      question: z.number().int(),
      work: z.string(),
      answer: z.array(z.enum([...OPTION_LETTERS, "none"])),
      literal: z.boolean(),
      leaks: z.array(z.enum(LEAKS)),
    }),
  ),
});
/* oxlint-enable eslint/sort-keys */

/** What a learner sees: never the key or the level it was written for. */
export type LevelTestQuestionToCheck = {
  passage: string;
  question: string;
  options: readonly string[];
};

/** `picks` holds option indexes and is empty when no option is right. */
export type LevelTestQuestionCheck = {
  leaks: Leak[];
  literal: boolean;
  picks: number[];
  work: string;
};

export type CheckLevelTestQuestionsParams = {
  questions: readonly LevelTestQuestionToCheck[];
  learnerLanguage: string;
  targetLanguage: string;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

const LETTER_INDEXES = new Map<string, number>(
  OPTION_LETTERS.map((letter, index) => [letter, index]),
);

function toPicks(answer: readonly string[]): number[] {
  const picks = answer.flatMap((letter) => {
    const index = LETTER_INDEXES.get(letter);
    return index === undefined ? [] : [index];
  });

  return picks.length === answer.length ? [...new Set(picks)] : [];
}

function buildUserPrompt(params: CheckLevelTestQuestionsParams): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  /* oxlint-disable eslint/sort-keys -- The model reads the text, then the question, then its options. */
  const questions = params.questions.map((question, index) => ({
    number: index + 1,
    text: question.passage,
    question: question.question,
    options: Object.fromEntries(
      question.options.map((option, optionIndex) => [OPTION_LETTERS[optionIndex] ?? "", option]),
    ),
  }));
  /* oxlint-enable eslint/sort-keys */

  return `TARGET_LANGUAGE: ${languages.targetLanguageName}
LEARNER_LANGUAGE: ${languages.userLanguageName}

${formatUntrustedInput({ QUESTIONS: JSON.stringify(questions, null, 1) })}`;
}

/**
 * Answers a placement test's questions without their keys and says how each one is answered. Each
 * check is in its question's place, and null when the model skipped it.
 */
export async function checkLevelTestQuestions(params: CheckLevelTestQuestionsParams) {
  const {
    analytics,
    model = defaultModel,
    reasoning = defaultReasoning,
    serviceTier,
    useFallback = true,
  } = params;

  const userPrompt = buildUserPrompt(params);

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
    task: "check-level-test-questions",
  });

  const checks: (LevelTestQuestionCheck | null)[] = params.questions.map((_, index) => {
    const entry = result.output.answers.find((answer) => answer.question === index + 1);

    return entry
      ? {
          leaks: entry.leaks,
          literal: entry.literal,
          picks: toPicks(entry.answer),
          work: entry.work,
        }
      : null;
  });

  return { data: { checks }, provenance, systemPrompt, usage: result.usage, userPrompt };
}

function quote(options: readonly string[], picks: readonly number[]): string {
  return picks.map((index) => `"${options[index] ?? "?"}"`).join(", ");
}

/** Null when the question can be stored; otherwise why it can't. */
export function findLevelTestQuestionProblem({
  check,
  question,
}: {
  check: LevelTestQuestionCheck | null;
  question: LevelTestQuestionToCheck & { answerIndex: number; level: CefrLevel };
}): string | null {
  if (!check) {
    return "The checker gave no answer.";
  }

  const { answerIndex, level, options } = question;
  const { leaks, literal, picks, work } = check;

  if (picks.length === 0) {
    return `No option is right: ${work}`;
  }

  if (picks.length > 1 || picks[0] !== answerIndex) {
    return `Keyed ${quote(options, [answerIndex])}, but the checker picked ${quote(options, picks)}: ${work}`;
  }

  if (leaks.length > 0) {
    return `It can be answered without the text (${leaks.join(", ")}): ${work}`;
  }

  if (literal && IMPLIED_LEVELS.has(level)) {
    return `A face-value reading answers this ${level} question: ${work}`;
  }

  return null;
}
