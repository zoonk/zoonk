import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-chapters.prompt.md";

const taskName = "course-chapters";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  chapters: z.array(
    z.object({
      description: z.string(),
      title: z.string(),
    }),
  ),
});

export type CourseChaptersSchema = z.infer<typeof schema>;
export type CourseChapter = CourseChaptersSchema["chapters"][number];

export type CourseChaptersParams = {
  language: string;
  courseTitle: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateCourseChapters({
  language,
  courseTitle,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: CourseChaptersParams) {
  const userPrompt = `
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle}
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
