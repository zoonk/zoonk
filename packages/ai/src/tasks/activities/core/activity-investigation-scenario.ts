import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-investigation-scenario.prompt.md";

const DEFAULT_MODEL = "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-sonnet-4.6"];

const schema = z.object({
  explanations: z.array(z.string()),
  scenario: z.string(),
  title: z.string().min(1),
});

export type ActivityInvestigationScenarioSchema = z.infer<typeof schema>;

export type ActivityInvestigationScenarioParams = {
  topic: string;
  language: string;
  concepts: string[];
  courseTitle?: string;
  chapterTitle?: string;
  lessonDescription?: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates the scenario frame for an investigation activity.
 * Produces a mystery scenario and possible explanations with accuracy
 * tiers (best/partial/wrong). This is phase 1 of investigation
 * generation — subsequent phases (actions, findings, debrief,
 * visuals, interpretations) take this output as input.
 */
export async function generateActivityInvestigationScenario({
  topic,
  language,
  concepts,
  courseTitle,
  chapterTitle,
  lessonDescription,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityInvestigationScenarioParams) {
  const userPrompt = `
    TOPIC: ${topic}
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle}
    CHAPTER_TITLE: ${chapterTitle}
    LESSON_DESCRIPTION: ${lessonDescription}
    CONCEPTS: ${concepts.join(", ")}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    model,
    reasoningEffort,
    taskName: "activity-investigation-scenario",
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
