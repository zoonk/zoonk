import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./step-image-prompts.prompt.md";

const taskName = "step-image-prompts";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const imagePromptSchema = z.string().min(1);

function buildSchema(stepCount: number) {
  return z.object({
    prompts: z.array(imagePromptSchema).length(stepCount),
  });
}

type StepImagePromptsParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  steps: { title: string; text: string }[];
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateStepImagePrompts({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  steps,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: StepImagePromptsParams) {
  const formattedSteps = steps
    .map((step, index) => `${index}. ${step.title}: ${step.text}`)
    .join("\n");

  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${language}
    STEPS: ${formattedSteps}
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
    output: Output.object({ schema: buildSchema(steps.length) }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
