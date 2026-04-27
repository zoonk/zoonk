import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./lesson-custom-activities.prompt.md";

const taskName = "lesson-custom-activities";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  activities: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type LessonCustomActivitiesSchema = z.infer<typeof schema>;
export type GeneratedCustomActivity = LessonCustomActivitiesSchema["activities"][number];

export type LessonCustomActivitiesParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLessonCustomActivities({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: LessonCustomActivitiesParams) {
  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${language}
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
