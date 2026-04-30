import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./lesson-kind.prompt.md";

const taskName = "lesson-kind";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  kind: z.enum(["explanation", "tutorial"]),
});

export type LessonKindSchema = z.infer<typeof schema>;

type LessonKindParams = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  lessonDescription: string;
  lessonTitle: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Classifying one lesson at a time lets chapter generation classify all planned
 * lessons in parallel while keeping the AI task focused on the specific lesson
 * title and description.
 */
export async function generateLessonKind({
  chapterTitle,
  courseTitle,
  language,
  lessonDescription,
  lessonTitle,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: LessonKindParams) {
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
