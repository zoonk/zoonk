import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import { getLanguagePromptContext } from "./_utils/language-prompt-context";
import systemPrompt from "./activity-sentence-variants.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_SENTENCE_VARIANTS ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["google/gemini-3.1-flash-lite-preview", "anthropic/claude-sonnet-4.6"];

const schema = z.object({
  sentences: z.array(
    z.object({
      alternativeSentences: z.array(z.string()),
      alternativeTranslations: z.array(z.string()),
      id: z.string(),
    }),
  ),
});

export type ActivitySentenceVariantsSchema = z.infer<typeof schema>;

export type ActivitySentenceVariantInput = {
  id: string;
  sentence: string;
  translation: string;
};

export type ActivitySentenceVariantsParams = {
  chapterTitle?: string;
  lessonDescription?: string;
  lessonTitle: string;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  sentences: ActivitySentenceVariantInput[];
  targetLanguage: string;
  userLanguage: string;
  useFallback?: boolean;
};

function formatSentences(sentences: ActivitySentenceVariantInput[]): string {
  return sentences
    .map(
      (sentence) =>
        `- id: ${sentence.id}\n  sentence: ${sentence.sentence}\n  translation: ${sentence.translation}`,
    )
    .join("\n");
}

export async function generateActivitySentenceVariants({
  chapterTitle,
  lessonDescription,
  lessonTitle,
  model = DEFAULT_MODEL,
  reasoningEffort,
  sentences,
  targetLanguage,
  userLanguage,
  useFallback = true,
}: ActivitySentenceVariantsParams) {
  const promptContext = getLanguagePromptContext({ targetLanguage, userLanguage });

  const userPrompt = `TARGET_LANGUAGE: ${promptContext.targetLanguageName}
USER_LANGUAGE: ${promptContext.userLanguage}
${chapterTitle ? `CHAPTER_TITLE: ${chapterTitle}\n` : ""}LESSON_TITLE: ${lessonTitle}
${lessonDescription ? `LESSON_DESCRIPTION: ${lessonDescription}\n` : ""}CANONICAL_SENTENCES:
${formatSentences(sentences)}

Review these fixed sentence pairs and return only strict accepted variants for learner answers.`;

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
