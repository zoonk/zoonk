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
import testPrompt from "./conversation-objectives-test.prompt.md";
import basePrompt from "./conversation-objectives.prompt.md";
import { type SpeakingMockExam } from "./exam-speaking-exams";

/**
 * GPT-Live reaches us through AI Gateway with client delegation only, so the voice model can't call
 * a tool to mark objectives and a text model reads the transcript. Luna got 18 of 19 on its eval
 * without ticking a goal early (27 Sep 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

const testSystemPrompt = `${basePrompt}\n${testPrompt}`;

export type CheckConversationObjectivesParams = {
  /** Only the objectives not reached yet. */
  objectives: { description: string; label: string }[];
  situation: string;
  characterNotes: string;
  /** Learner turns are untrusted input. */
  turns: ConversationTurn[];
  /** Unset or null for a role play. */
  exam?: SpeakingMockExam | null;
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

/** Only through the learner's own words, all of it, and understood rather than perfect. */
export async function checkConversationObjectives(params: CheckConversationObjectivesParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const [first, ...rest] = params.objectives.map((objective) => objective.label);

  if (!first) {
    throw new Error("A check needs at least one open objective.");
  }

  const systemPrompt = params.exam ? testSystemPrompt : basePrompt;
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
