import "server-only";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import {
  type ConversationTurn,
  formatConversationTranscript,
} from "./_utils/conversation-transcript";
import systemPrompt from "./conversation-feedback.prompt.md";

export type { ConversationTurn } from "./_utils/conversation-transcript";

/**
 * Luna scored 9.34 on the conversation-feedback eval and passed every code check; Flash Lite was
 * faster but wrote a wrong correction (Sep 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.1-flash-lite"] as const;

const MAX_WENT_WELL = 3;
const MAX_PRONUNCIATION_WORDS = 2;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: what went well comes before the one fix, and the kind line last. */
const schema = z.object({
  wentWell: z.array(z.string()).max(MAX_WENT_WELL),
  improve: z.object({ said: z.string(), better: z.string(), why: z.string() }).nullable(),
  pronunciation: z
    .array(z.object({ word: z.string(), respelling: z.string(), tip: z.string() }))
    .max(MAX_PRONUNCIATION_WORDS),
  encouragement: z.string(),
});
/* oxlint-enable eslint/sort-keys */

export type WriteConversationFeedbackSchema = z.infer<typeof schema>;

export type WriteConversationFeedbackParams = {
  scenario: { title: string; situation: string; characterName: string; objectives: string[] };
  level: CefrLevel;
  /** Learner turns are untrusted input. */
  turns: ConversationTurn[];
  objectivesMet: string[];
  targetLanguage: string;
  learnerLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "none";
}

function buildUserPrompt(params: WriteConversationFeedbackParams): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  const transcript = formatConversationTranscript({
    labels: { character: "CHARACTER", learner: "LEARNER" },
    turns: params.turns,
  });

  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}
    LEVEL: ${params.level}
    CALL_TITLE: ${params.scenario.title}
    SITUATION: ${params.scenario.situation}
    CHARACTER_NAME: ${params.scenario.characterName}
    OBJECTIVES:
${formatList(params.scenario.objectives)}
    OBJECTIVES_MET:
${formatList(params.objectivesMet)}

${formatUntrustedInput({ TRANSCRIPT: transcript })}
  `;
}

/**
 * A text model writes it from the transcript: the voice model that played the character never
 * grades.
 */
export async function writeConversationFeedback(params: WriteConversationFeedbackParams) {
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
    task: "conversation-feedback",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
