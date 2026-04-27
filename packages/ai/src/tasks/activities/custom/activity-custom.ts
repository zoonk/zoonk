import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-custom.prompt.md";

const taskName = "activity-custom";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  steps: z.array(
    z.object({
      text: z.string(),
      title: z.string(),
    }),
  ),
});

export type ActivityCustomSchema = z.infer<typeof schema>;

export type ActivityCustomParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  activityTitle: string;
  activityDescription: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateActivityCustom({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  activityTitle,
  activityDescription,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: ActivityCustomParams) {
  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${language}
    ACTIVITY_TITLE: ${activityTitle}
    ACTIVITY_DESCRIPTION: ${activityDescription}
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
