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
 * The learner waits for this after speaking, and it is stored and reused for
 * everyone who says the same thing. In the eval (7 cases across three
 * language pairs, Sep 2026) Luna scored 8.90 at 2.9s p50, Gemini 3.8 Flash
 * 8.80 at 3.2s, and Flash Lite 7.69 at 1.0s, with vaguer tips.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;

const schema = z.object({ explanation: z.string() });

export type ExplainSpokenAnswerSchema = z.infer<typeof schema>;

/** A word of the expected sentence that didn't match, with what we heard (null: nothing). */
type SpokenWordToExplain = { expected: string; heard: string | null; respelling?: string };

export type ExplainSpokenAnswerParams = {
  expectedSentence: string;
  /** The whole transcript. */
  heard: string;
  /** One or two words, chosen by code from the word-by-word comparison. */
  words: SpokenWordToExplain[];
  targetLanguage: string;
  /** The learner's language, used for the explanation. */
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

/**
 * Explains the words a learner said differently from the expected sentence:
 * what we heard, the likely cause from how their own language works, and one
 * thing to do differently. Stored by step and transcript, so the next learner
 * who says the same thing gets it without a model call.
 */
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
