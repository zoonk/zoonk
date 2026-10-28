import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./explain-spoken-answer.prompt.md";

/**
 * Stored and reused for everyone who says the same thing: Luna scored 8.90 at 2.9s p50 (Sep 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

const schema = z.object({ explanation: z.string() });

export type ExplainSpokenAnswerSchema = z.infer<typeof schema>;

/** `heard` is null when nothing was heard. */
type SpokenWordToExplain = { expected: string; heard: string | null; respelling?: string };

export type ExplainSpokenAnswerParams = {
  expectedSentence: string;
  heard: string;
  /** Chosen by code from the word-by-word comparison. */
  words: SpokenWordToExplain[];
  targetLanguage: string;
  learnerLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatWord(word: SpokenWordToExplain): string {
  const heard = word.heard ? `"${word.heard}"` : "nothing";
  const respelling = word.respelling ? ` (respelling: ${word.respelling})` : "";

  return `- "${word.expected}"${respelling}: we heard ${heard}`;
}

/** Stored by step and transcript, so the next learner who says the same thing skips the model. */
export async function explainSpokenAnswer({
  analytics,
  expectedSentence,
  heard,
  learnerLanguage,
  model = defaultModel,
  reasoning,
  targetLanguage,
  useFallback = true,
  words,
}: ExplainSpokenAnswerParams) {
  const languages = getLanguagePromptContext({ targetLanguage, userLanguage: learnerLanguage });

  const userPrompt = `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}
    EXPECTED_SENTENCE: ${expectedSentence}

${formatUntrustedInput({ HEARD: heard, WORDS_TO_EXPLAIN: words.map((word) => formatWord(word)).join("\n") })}
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
    task: "explain-spoken-answer",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
