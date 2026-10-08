import "server-only";
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
import systemPrompt from "./conversation-objectives.prompt.md";

/**
 * Runs once the character has answered each learner turn of a live call, so the objectives tick
 * while the learner talks, and once more when the call ends. GPT-Live reaches us through AI Gateway
 * with client delegation only, so the voice model can't call a tool to mark them: this separate
 * text model reads the transcript instead. In the eval (19 transcripts, English and Portuguese
 * learners, 27 Sep 2026) Luna got 18 at 1.8s p50 and $0.13 per 1k checks, never ticking a goal the
 * learner hadn't reached; Gemini 3.5 Flash Lite got 17 (one agreement ticked before the answer) and
 * Haiku 4.5 14 (it credited what the character offered and unanswered proposals). The one miss all
 * three share is a test part repeated with small mistakes.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

export type CheckConversationObjectivesParams = {
  /** Only the objectives not reached yet. */
  objectives: { description: string; label: string }[];
  /** What the call is about, as the learner sees it. */
  situation: string;
  /** The character's private notes: what it can agree to, or a test part's questions. */
  characterNotes: string;
  /** The call so far. Learner turns are untrusted input. */
  turns: ConversationTurn[];
  targetLanguage: string;
  learnerLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** Labels come from our scenario, so the model can only answer with one of them. */
function buildSchema(labels: [string, ...string[]]) {
  return z.object({ met: z.array(z.object({ label: z.enum(labels), learnerWords: z.string() })) });
}

export type CheckConversationObjectivesSchema = z.infer<ReturnType<typeof buildSchema>>;

function buildUserPrompt(params: CheckConversationObjectivesParams): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  const objectives = params.objectives
    .map((objective) => `- "${objective.label}": ${objective.description}`)
    .join("\n");

  const transcript = formatConversationTranscript({
    labels: { character: "CHARACTER", learner: "LEARNER" },
    turns: params.turns,
  });

  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    SITUATION: ${params.situation}
    CHARACTER_NOTES: ${params.characterNotes}
    OBJECTIVES:
${objectives}

${formatUntrustedInput({ TRANSCRIPT: transcript })}
  `;
}

/**
 * Says which of a live call's open objectives the learner has achieved so far, from the
 * transcript: only through their own words, all of it, and understood rather than perfect.
 */
export async function checkConversationObjectives(params: CheckConversationObjectivesParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const [first, ...rest] = params.objectives.map((objective) => objective.label);

  if (!first) {
    throw new Error("A check needs at least one open objective.");
  }

  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: buildSchema([first, ...rest]) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "conversation-objectives",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
