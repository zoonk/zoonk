import "server-only";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { isSameLanguage } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { type z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { formatLocalContext } from "../_utils/language-context";
import { fillPromptLanguages } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { scenarioSchema } from "./_utils/scenario-schema";
import promptTemplate from "./conversation-scenario.prompt.md";

/** Cached per chapter and level and shared, so it runs rarely: Luna scored 9.22 (Sep 2026). */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite"] as const;

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

function buildSystemPrompt(params: GenerateConversationScenarioParams): string {
  const template = selectPromptVariants({
    template: promptTemplate,
    variants: { bilingual: !isSameLanguage(params) },
  });

  return fillPromptLanguages({ ...params, template });
}

function buildUserPrompt(params: GenerateConversationScenarioParams): string {
  return `
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
  const systemPrompt = buildSystemPrompt(params);
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
