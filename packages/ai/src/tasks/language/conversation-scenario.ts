import "server-only";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { Output, generateText } from "ai";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { formatLocalContext } from "../_utils/language-context";
import { getLanguagePromptContext } from "../_utils/prompt-language";
import { type ScenarioSchema, buildScenarioSchema } from "./_utils/scenario-schema";
import systemPrompt from "./conversation-scenario.prompt.md";

/** Cached per chapter and level and shared, so it runs rarely: Luna scored 9.22 (Sep 2026). */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

export type GenerateConversationScenarioSchema = ScenarioSchema;

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

function buildUserPrompt({
  languages,
  params,
}: {
  languages: ReturnType<typeof getLanguagePromptContext>;
  params: GenerateConversationScenarioParams;
}): string {
  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}
    LEVEL: ${params.level}
    UNIT_TITLE: ${params.unitTitle}
    UNIT_DESCRIPTION: ${params.unitDescription}
    UNIT_CAN_DO:
${params.canDo.map((item) => `- ${item}`).join("\n")}

${formatLocalContext(params.targetLanguage, { register: false })}
  `;
}

export async function generateConversationScenario(params: GenerateConversationScenarioParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;

  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  const userPrompt = buildUserPrompt({ languages, params });

  const schema = buildScenarioSchema({
    learnerLanguage: languages.userLanguageName,
    targetLanguage: languages.targetLanguageName,
  });

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
    libraryInput: true,
    systemPrompt,
    task: "conversation-scenario",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
