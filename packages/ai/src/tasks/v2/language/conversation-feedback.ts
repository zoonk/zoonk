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
 * The learner waits for this right after a call, and it runs once per call.
 * In the eval (an A2 call with typical mistakes, one where the learner barely
 * spoke and a strong B2 call, Sep 2026) Luna scored 9.33 at 7.5s p50 and
 * $0.53 per 1k runs, passing every code check; Gemini 3.1 Flash Lite 8.55 at
 * 1.8s and $0.75, with a wrong correction and a word the learner never said.
 * Pronunciation words now only name slips that change a word, not an accent:
 * on all five cases (28 Sep 2026) Luna scored 9.34 and listed none, where it
 * had listed seven, mostly accent-only ("Thursday", "alquiler").
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
  /** Transcripts of the call. Learner turns are untrusted input. */
  turns: ConversationTurn[];
  /** Labels of the objectives the call marked as met. */
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
 * Writes the feedback a learner reads after a live call: phrases they said
 * well, the one thing to fix, words speakers of their language often find
 * hard, and a kind line. A text model writes it from the transcript because
 * the voice model that played the character never grades.
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
