import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-goal-routing.prompt.md";

export const courseGoalValues = [
  "masterSubject",
  "quickLearning",
  "personalizedGoal",
  "learnLanguage",
  "passExam",
  "unsafe",
] as const;

const schema = z.object({ goal: z.enum(courseGoalValues) });

const defaultModel = "google/gemini-3.1-flash-lite";

const fallbackModels = [
  "openai/gpt-5.4-mini",
  "anthropic/claude-haiku-4.5",
  "deepseek/deepseek-v4-flash",
] as const;

export type CourseGoal = (typeof courseGoalValues)[number];
export type CourseGoalRoutingSchema = z.infer<typeof schema>;

export type CourseGoalRoutingParams = {
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Builds a small JSON payload so routing evals and production classify only
 * the learner's untrusted goal text. Goal routing should not depend on UI
 * locale because the same request should map to the same mode in any interface
 * language.
 */
function buildCourseGoalRoutingUserPrompt({
  prompt,
}: Pick<CourseGoalRoutingParams, "prompt">): string {
  return JSON.stringify({ userGoal: prompt }, null, 2);
}

/**
 * Classifies the learner's goal before any reusable course suggestion is
 * created. This keeps unsupported and unsafe goals out of the shared course
 * catalog until Zoonk has a dedicated generation mode for them.
 */
export async function routeCourseGoal({
  model = defaultModel,
  prompt,
  reasoningEffort,
  useFallback = true,
}: CourseGoalRoutingParams) {
  const userPrompt = buildCourseGoalRoutingUserPrompt({ prompt });

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoningEffort,
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
