import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { ACTIVITY_OPTIONS_COUNT, formatConceptLines } from "../config";
import { getLanguagePromptContext } from "./_utils/language-prompt-context";
import systemPrompt from "./activity-practice.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_LANGUAGE_PRACTICE ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3-flash"];

const schema = z.object({
  scenario: z.string(),
  steps: z.array(
    z.object({
      context: z.string(),
      contextRomanization: z.string().nullable(),
      contextTranslation: z.string(),
      options: z
        .array(
          z.object({
            feedback: z.string(),
            isCorrect: z.boolean(),
            text: z.string(),
            textRomanization: z.string().nullable(),
            translation: z.string(),
          }),
        )
        .length(ACTIVITY_OPTIONS_COUNT),
    }),
  ),
});

export type ActivityPracticeLanguageSchema = z.infer<typeof schema>;

export type ActivityPracticeLanguageParams = {
  chapterTitle: string;
  concepts?: string[];
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  neighboringConcepts?: string[];
  reasoningEffort?: ReasoningEffort;
  targetLanguage: string;
  userLanguage: string;
  useFallback?: boolean;
};

export async function generateActivityPracticeLanguage({
  chapterTitle,
  concepts = [],
  lessonDescription,
  lessonTitle,
  model = DEFAULT_MODEL,
  neighboringConcepts = [],
  reasoningEffort,
  targetLanguage,
  userLanguage,
  useFallback = true,
}: ActivityPracticeLanguageParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `TARGET_LANGUAGE: ${promptContext.targetLanguageName}
USER_LANGUAGE: ${promptContext.userLanguage}
CHAPTER_TITLE: ${chapterTitle}
LESSON_TITLE: ${lessonTitle}
LESSON_DESCRIPTION: ${lessonDescription}
${formatConceptLines(concepts, neighboringConcepts)}

Generate an immersive dialogue-driven practice activity for this language lesson. Create a realistic everyday scenario where learners practice language production in situations they'd face in a foreign country.`;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
