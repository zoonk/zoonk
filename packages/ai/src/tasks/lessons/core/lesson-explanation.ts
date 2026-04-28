import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./lesson-explanation.prompt.md";

const taskName = "lesson-explanation";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const anchorSchema = z
  .object({
    text: z.string(),
    title: z.string().min(1),
  })
  .strict();

const explanationStepSchema = z
  .object({
    text: z.string(),
    title: z.string().min(1),
  })
  .strict();

const schema = z
  .object({
    anchor: anchorSchema,
    explanation: z.array(explanationStepSchema),
  })
  .strict();

export type LessonExplanationSchema = z.infer<typeof schema>;

export type LessonExplanationParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  otherLessonTitles: string[];
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateLessonExplanation({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  otherLessonTitles,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: LessonExplanationParams) {
  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${language}
    LESSON_GOAL: ${lessonDescription}
    OTHER_EXPLANATION_LESSON_TITLES: ${otherLessonTitles.join(", ")}
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
