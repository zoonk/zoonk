import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { getLanguageName } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./language-chapter-lessons.prompt.md";

const taskName = "language-chapter-lessons";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  lessons: z.array(
    z.object({
      description: z.string(),
      kind: z.enum(["alphabet", "grammar", "vocabulary"]),
      title: z.string(),
    }),
  ),
});

export type LanguageChapterLessonsSchema = z.infer<typeof schema>;
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
  const targetLanguageName = getLanguageName({ targetLanguage, userLanguage });

  const userPrompt = `
    USER_LANGUAGE: ${userLanguage}
    CHAPTER_TITLE: ${chapterTitle}
    CHAPTER_DESCRIPTION: ${chapterDescription}
    TARGET_LANGUAGE: ${targetLanguageName}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
    taskName,
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
