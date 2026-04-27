import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-explanation.prompt.md";

const taskName = "activity-explanation";
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

export type ActivityExplanationSchema = z.infer<typeof schema>;

export type ActivityExplanationParams = {
  lessonTitle: string;
  lessonDescription: string;
  chapterTitle: string;
  courseTitle: string;
  language: string;
  activityGoal: string;
  activityTitle: string;
  lessonConcepts: string[];
  otherActivityTitles: string[];
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateActivityExplanation({
  lessonTitle,
  lessonDescription,
  chapterTitle,
  courseTitle,
  language,
  activityGoal,
  activityTitle,
  lessonConcepts,
  otherActivityTitles,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: ActivityExplanationParams) {
  const userPrompt = `
    LESSON_TITLE: ${lessonTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CHAPTER_TITLE: ${chapterTitle}
    COURSE_TITLE: ${courseTitle}
    LANGUAGE: ${language}
    ACTIVITY_TITLE: ${activityTitle}
    ACTIVITY_GOAL: ${activityGoal}
    LESSON_CONCEPTS: ${lessonConcepts.join(", ")}
    OTHER_EXPLANATION_ACTIVITY_TITLES: ${otherActivityTitles.join(", ")}
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
