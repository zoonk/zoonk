import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import { normalizeMistakePattern } from "./mistake-pattern-rules";
import systemPrompt from "./mistake-pattern.prompt.md";

/**
 * Luna scored 9.29 on the mistake-pattern eval with the right kind every time; Flash Lite stated a
 * false rule about Portuguese (Sep 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.1-flash-lite"] as const;

const MAX_CONTRAST_ROWS = 3;
const DRILL_QUESTIONS = 5;

/** Only the forms the pattern confuses: two for "since" and "for", three at most. */
const MIN_DRILL_OPTIONS = 2;
const MAX_DRILL_OPTIONS = 3;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the verdict and the mistakes that show it come before the rule and the drill. */
const schema = z.object({
  kind: z.enum(["pattern", "typos", "none"]),
  mistakeNumbers: z.array(z.number().int()),
  title: z.string(),
  rule: z.string(),
  contrast: z.array(z.object({ label: z.string(), example: z.string() })).max(MAX_CONTRAST_ROWS),
  drill: z
    .array(
      z.object({
        sentence: z.string(),
        answer: z.string(),
        options: z.array(z.string()).min(MIN_DRILL_OPTIONS).max(MAX_DRILL_OPTIONS),
        feedback: z.string(),
      }),
    )
    .max(DRILL_QUESTIONS),
});
/* oxlint-enable eslint/sort-keys */

export type FindMistakePatternSchema = z.infer<typeof schema>;

type LanguageMistake = { question: string; answer: string; correctAnswer: string; format: string };

export type FindMistakePatternParams = {
  /** 3 to 20 recent mistakes, newest first. Answers are untrusted input. */
  mistakes: LanguageMistake[];
  targetLanguage: string;
  learnerLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatMistake(mistake: LanguageMistake, index: number): string {
  return [
    `${index + 1}. (${mistake.format}) ${mistake.question}`,
    `   Learner answered: ${mistake.answer}`,
    `   Correct answer: ${mistake.correctAnswer}`,
  ].join("\n");
}

function buildUserPrompt(params: FindMistakePatternParams): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  const mistakes = params.mistakes.map((mistake, index) => formatMistake(mistake, index));

  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}

${formatUntrustedInput({ MISTAKES: mistakes.join("\n") })}
  `;
}

export async function findMistakePattern(params: FindMistakePatternParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
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
    task: "mistake-pattern",
  });

  const data = normalizeMistakePattern({
    mistakeCount: params.mistakes.length,
    pattern: result.output,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
