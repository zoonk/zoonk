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

/** Cached per chapter and level and shared, so it runs rarely: Luna scored 9.22 (Sep 2026). */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.1-flash-lite"] as const;

export type GenerateConversationScenarioSchema = z.infer<typeof scenarioSchema>;

export type GenerateConversationScenarioParams = {
  unitTitle: string;
  unitDescription: string;
  canDo: string[];
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
