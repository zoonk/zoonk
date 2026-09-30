import "server-only";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import systemPrompt from "./conversation-scenario.prompt.md";

/**
 * Cached per chapter and level and shared by every learner there, so it runs
 * rarely. In the eval (pt-en A2 renting, the pt-en B1 IELTS mock and en-es A2,
 * Sep 2026) Luna scored 9.22 at 9.5s p50 and $0.69 per 1k runs; Gemini 3.1
 * Flash Lite 8.63 at 2.2s and $1.06. Luna swapped label and description
 * languages in the Spanish case, which the prompt now checks (spot-checked).
 * With the TOEFL mock added (27 Sep), Luna scored 9.3 on the IELTS and 8.7 on
 * the TOEFL mock: seven original sentences from 5 to 19 words and four
 * questions from a fact to a prediction.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.1-flash-lite"] as const;

const MIN_OBJECTIVES = 2;
const MAX_OBJECTIVES = 4;
const MIN_HINTS = 3;
const MAX_HINTS = 5;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the character's facts come before the lines and hints that use them. */
const schema = z.object({
  title: z.string(),
  situation: z.string(),
  character: z.object({ name: z.string(), role: z.string(), place: z.string() }),
  characterBrief: z.string(),
  objectives: z
    .array(z.object({ label: z.string(), description: z.string() }))
    .min(MIN_OBJECTIVES)
    .max(MAX_OBJECTIVES),
  openingLine: z.string(),
  hints: z.array(z.string()).min(MIN_HINTS).max(MAX_HINTS),
});
/* oxlint-enable eslint/sort-keys */

export type GenerateConversationScenarioSchema = z.infer<typeof schema>;

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
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    systemPrompt,
    task: "conversation-scenario",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
