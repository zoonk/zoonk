import "server-only";
import { buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { formatExplanationStepsForPrompt } from "./_utils/format-explanation-steps";
import { type ActivityStoryParams } from "./activity-story";
import systemPrompt from "./activity-story-choices.prompt.md";
import {
  type ActivityStoryChoicesSchema,
  type ActivityStoryPlanSchema,
  buildActivityStoryWithChoices,
  createActivityStoryChoicesSchema,
} from "./activity-story-schemas";

const DEFAULT_MODEL = "openai/gpt-5.4";

export { buildActivityStoryWithChoices };
export type { ActivityStoryChoicesSchema };

export type ActivityStoryChoicesParams = ActivityStoryParams & {
  storyPlan: ActivityStoryPlanSchema;
};

/**
 * Serializes the already-planned story into the choice task input so this
 * model call can focus only on decision labels, consequences, and state
 * prompts without re-planning the scenario.
 */
function formatStoryPlanForPrompt(storyPlan: ActivityStoryPlanSchema) {
  return JSON.stringify(storyPlan, null, 2);
}

/**
 * Generates choices for an existing story skeleton.
 * This separate task gives answer masking its own prompt budget while keeping
 * consequences, metric effects, and state image prompts causally aligned.
 */
export async function generateActivityStoryChoices({
  topic,
  language,
  concepts,
  courseTitle,
  chapterTitle,
  lessonDescription,
  explanationSteps,
  storyPlan,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityStoryChoicesParams) {
  const formattedExplanationSteps = formatExplanationStepsForPrompt(explanationSteps);
  const formattedStoryPlan = formatStoryPlanForPrompt(storyPlan);
  const outputSchema = createActivityStoryChoicesSchema(storyPlan);

  const userPrompt = `
    TOPIC: ${topic}
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle}
    CHAPTER_TITLE: ${chapterTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CONCEPTS: ${concepts.join(", ")}
    EXPLANATION_STEPS: ${formattedExplanationSteps}
    STORY_PLAN: ${formattedStoryPlan}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels: [],
    model,
    reasoningEffort,
    taskName: "activity-story-choices",
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema: outputSchema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
