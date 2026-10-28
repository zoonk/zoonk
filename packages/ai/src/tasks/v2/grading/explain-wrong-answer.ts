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
 * Made once per mistake and shared, so quality wins: Sol scored 9.69 at 2.8s p50, and slower models
 * were within noise (13 Oct 2026).
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["openai/gpt-6-luna", "google/gemini-3.8-flash"] as const;

const schema = z.object({ explanation: z.string() });

export type ExplainWrongAnswerSchema = z.infer<typeof schema>;

export type ExplainWrongAnswerParams = {
  question: string;
  correctAnswer: string;
  keyPoints?: string[];
  misconceptions?: string[];
  answer: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatList(values: readonly string[] | undefined): string {
  return values && values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "none";
}

/** Written for anyone who gives the same answer: it's stored by item and normalized answer. */
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
