import "server-only";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { Output, generateText } from "ai";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getLanguagePromptContext } from "../../_utils/prompt-language";
import { scenarioSchema } from "./_utils/scenario-schema";
import { type GenerateConversationScenarioSchema } from "./conversation-scenario";
import { type SpeakingMockExam } from "./exam-speaking-exams";
import ieltsPrompt from "./speaking-mock-scenario-ielts.prompt.md";
import toeflPrompt from "./speaking-mock-scenario-toefl.prompt.md";
import mockPrompt from "./speaking-mock-scenario.prompt.md";

/**
 * Usually written ahead, so the next try starts at once. Luna scored 9.3 on the IELTS and 8.7 on
 * the TOEFL mock (27 Sep 2026).
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.1-flash-lite"] as const;

/**
 * TOEFL iBT Speaking takes about 8 minutes: 7 sentences to repeat, then 4 interview questions of 45
 * seconds (ETS, checked Sep 2026:
 * https://www.in.ets.org/content/dam/ets-india/pdfs/toefl/toefl-ibt-test-overview.pdf). IELTS
 * Speaking takes 11 to 14 minutes in three parts.
 */
const SYSTEM_PROMPTS: Record<SpeakingMockExam, string> = {
  ielts: `${mockPrompt}\n${ieltsPrompt}`,
  toefl: `${mockPrompt}\n${toeflPrompt}`,
};

export type GenerateSpeakingMockScenarioParams = {
  exam: SpeakingMockExam;
  /** Usually shorter than the real test. */
  minutes: number;
  /** Shapes the hints, never the examiner's wording. */
  level: CefrLevel;
  targetLanguage: string;
  learnerLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt(params: GenerateSpeakingMockScenarioParams): string {
  const languages = getLanguagePromptContext({
    targetLanguage: params.targetLanguage,
    userLanguage: params.learnerLanguage,
  });

  return `
    TARGET_LANGUAGE: ${languages.targetLanguageName}
    LEARNER_LANGUAGE: ${languages.userLanguageName}
    LEVEL: ${params.level}
    MINUTES: ${params.minutes}
  `;
}

/** The call runs it like a role play, with the examiner as the character. */
export async function generateSpeakingMockScenario(params: GenerateSpeakingMockScenarioParams) {
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const systemPrompt = SYSTEM_PROMPTS[params.exam];
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
    systemPrompt,
    task: "speaking-mock-scenario",
  });

  const data: GenerateConversationScenarioSchema = result.output;

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
