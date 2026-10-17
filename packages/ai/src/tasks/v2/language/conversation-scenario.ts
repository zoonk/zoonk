import "server-only";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { Output, generateText } from "ai";
import { type z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import { scenarioSchema } from "./_utils/scenario-schema";
import systemPrompt from "./conversation-scenario.prompt.md";

/**
 * Cached per chapter and level and shared by every learner there, so it runs
 * rarely. In the eval (pt-en A2 renting, a pt-en B1 IELTS mock and en-es A2,
 * Sep 2026) Luna scored 9.22 at 9.5s p50 and $0.69 per 1k runs; Gemini 3.1
 * Flash Lite 8.63 at 2.2s and $1.06. Luna swapped label and description
 * languages in the Spanish case, which the prompt now checks (spot-checked).
 * Exam mocks have their own task (`speaking-mock-scenario`).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.1-flash-lite"] as const;

export type GenerateConversationScenarioSchema = z.infer<typeof scenarioSchema>;

export type GenerateConversationScenarioParams = {
  /** The unit's title in the learner's language. */
  unitTitle: string;
  unitDescription: string;
  /** The unit's "I can" objectives, in the learner's language. */
  canDo: string[];
  /** The learner's speaking level: the character talks at it. */
  level: CefrLevel;
  targetLanguage: string;
  learnerLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt(params: GenerateConversationScenarioParams): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}
    LEVEL: ${params.level}
    UNIT_TITLE: ${params.unitTitle}
    UNIT_DESCRIPTION: ${params.unitDescription}
    UNIT_CAN_DO:
${params.canDo.map((item) => `- ${item}`).join("\n")}

${formatLocalContext(params.targetLanguage)}
  `;
}

/**
 * Writes the role-play call for a unit at one level: the goal, who the
 * learner talks to, the character's first line, what to achieve, phrases to
 * lean on and private facts for the voice model. Shared by every learner of
 * that unit and level.
 */
export async function generateConversationScenario(params: GenerateConversationScenarioParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: scenarioSchema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "conversation-scenario",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
