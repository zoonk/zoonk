import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./language-chapter-lessons.prompt.md";

const defaultModel = "openai/gpt-5.6-sol";
const fallbackModels = ["google/gemini-3.1-pro-preview", "anthropic/claude-sonnet-4.6"] as const;

const schema = z.object({
  lessons: z.array(
    z.object({
      description: z.string(),
      kind: z.enum(["alphabet", "grammar", "vocabulary"]),
      title: z.string(),
    }),
  ),
});

type LanguageChapterLessonsSchema = z.infer<typeof schema>;
export type LanguageChapterLesson = LanguageChapterLessonsSchema["lessons"][number];

export async function generateLanguageChapterLessons({
  chapterDescription,
  chapterTitle,
  userLanguage,
  targetLanguage,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: {
  chapterDescription: string;
  chapterTitle: string;
  userLanguage: string;
  targetLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
}) {
  const targetLanguageName = getPromptLanguageName({ language: targetLanguage, userLanguage });
  const userLanguageName = getPromptLanguageName({ language: userLanguage });

  const userPrompt = `
    USER_LANGUAGE: ${userLanguageName}
    CHAPTER_TITLE: ${chapterTitle}
    CHAPTER_DESCRIPTION: ${chapterDescription}
    TARGET_LANGUAGE: ${targetLanguageName}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
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
