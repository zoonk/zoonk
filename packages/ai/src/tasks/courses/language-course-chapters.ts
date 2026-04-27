import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { getLanguageName } from "@zoonk/utils/languages";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./language-course-chapters.prompt.md";

const taskName = "language-course-chapters";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  chapters: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type LanguageCourseChaptersSchema = z.infer<typeof schema>;

export type LanguageCourseChaptersParams = {
  userLanguage: string;
  targetLanguage: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLanguageCourseChapters({
  userLanguage,
  targetLanguage,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: LanguageCourseChaptersParams) {
  const targetLanguageName = getLanguageName({ targetLanguage, userLanguage });

  const userPrompt = `
    USER_LANGUAGE: ${userLanguage}
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
