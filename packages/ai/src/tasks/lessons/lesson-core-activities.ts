import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./lesson-core-activities.prompt.md";

const taskName = "lesson-core-activities";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  activities: z.array(
    z.object({
      goal: z.string(),
      title: z.string(),
    }),
  ),
});

export type LessonCoreActivitiesSchema = z.infer<typeof schema>;
export type GeneratedCoreActivity = LessonCoreActivitiesSchema["activities"][number];

export type LessonCoreActivitiesParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  concepts: string[];
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Core lessons need a small explanation plan before the per-activity content
 * workflow starts. Each planned activity carries a practical title plus a
 * short goal so the downstream explanation generator knows the exact teaching
 * move it should deliver without falling back to one-concept-at-a-time titles.
 */
export async function generateLessonCoreActivities({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  concepts,
  language,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: LessonCoreActivitiesParams) {
  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    CONCEPTS: ${concepts.join(", ")}
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
