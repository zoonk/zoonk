import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import systemPrompt from "./explain-wrong-answer.prompt.md";

/**
 * Made once per mistake and shared, so quality wins: in the eval (6 cases,
 * Sep 2026) Sol scored 9.63 at 2.2s p50, Luna 9.33 and Gemini 3.8 Flash 9.02.
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["openai/gpt-6-luna", "google/gemini-3.8-flash"] as const;

const schema = z.object({ explanation: z.string() });

export type ExplainWrongAnswerSchema = z.infer<typeof schema>;

export type ExplainWrongAnswerParams = {
  question: string;
  /** A full correct answer: the sample answer or the first accepted answer. */
  correctAnswer: string;
  keyPoints?: string[];
  /** The item's misconceptions, so the explanation names a known one when it fits. */
  misconceptions?: string[];
  answer: string;
  /** The learner's language, used for the explanation. */
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatList(values: readonly string[] | undefined): string {
  return values && values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "none";
}

/**
 * Explains why a typed or spoken answer is wrong and what the right idea is.
 * The explanation is written for anyone who gives the same answer, because it
 * is stored by item and normalized answer and reused for the next learner who
 * makes the same mistake.
 */
export async function explainWrongAnswer({
  analytics,
  answer,
  correctAnswer,
  keyPoints,
  language,
  misconceptions,
  model = defaultModel,
  question,
  reasoning,
  useFallback = true,
}: ExplainWrongAnswerParams) {
  const userPrompt = `
    LANGUAGE: ${getPromptLanguageName({ language })}
${formatLocalContext(language)}
    QUESTION: ${question}
    CORRECT_ANSWER: ${correctAnswer}
    KEY_POINTS:
${formatList(keyPoints)}
    KNOWN_MISCONCEPTIONS:
${formatList(misconceptions)}

${formatUntrustedInput({ LEARNER_ANSWER: answer })}
  `;

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
    task: "explain-wrong-answer",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
