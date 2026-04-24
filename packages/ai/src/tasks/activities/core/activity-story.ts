import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { formatExplanationStepsForPrompt } from "./_utils/format-explanation-steps";
import { activityStoryPlanSchema } from "./activity-story-schemas";
import systemPrompt from "./activity-story.prompt.md";

const DEFAULT_MODEL = "openai/gpt-5.4";

export type { ActivityStoryPlanSchema, ActivityStorySchema } from "./activity-story-schemas";

export type ActivityStoryParams = {
  topic: string;
  language: string;
  concepts: string[];
  courseTitle?: string;
  chapterTitle?: string;
  lessonDescription?: string;
  explanationSteps: { title: string; text: string }[];
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates the story skeleton without choices.
 * The main task owns scenario, metrics, step problems, image prompts, and
 * outcomes so the applied case stays coherent before the focused choice task
 * fills learner decisions.
 */
export async function generateActivityStory({
  topic,
  language,
  concepts,
  courseTitle,
  chapterTitle,
  lessonDescription,
  explanationSteps,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityStoryParams) {
  const formattedExplanationSteps = formatExplanationStepsForPrompt(explanationSteps);

  const userPrompt = `
    TOPIC: ${topic}
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle}
    CHAPTER_TITLE: ${chapterTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CONCEPTS: ${concepts.join(", ")}
    EXPLANATION_STEPS: ${formattedExplanationSteps}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels: [],
    model,
    reasoningEffort,
    taskName: "activity-story",
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema: activityStoryPlanSchema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
