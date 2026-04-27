import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-description.prompt.md";

const taskName = "course-description";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  description: z.string(),
});

export type CourseDescriptionSchema = z.infer<typeof schema>;

export type CourseDescriptionParams = {
  title: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateCourseDescription({
  title,
  language,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: CourseDescriptionParams) {
  const userPrompt = `
    COURSE_TITLE: ${title}
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
