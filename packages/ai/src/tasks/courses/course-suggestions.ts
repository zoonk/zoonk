import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./course-suggestions.prompt.md";

const taskName = "course-suggestions";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  courses: z.array(
    z.object({
      description: z.string(),
      targetLanguageCode: z.string().nullable(),
      title: z.string(),
    }),
  ),
});

export type CourseSuggestionSchema = z.infer<typeof schema>;

export type CourseSuggestionsParams = {
  language: string;
  prompt: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateCourseSuggestions({
  language,
  prompt,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: CourseSuggestionsParams) {
  const userPrompt = `
    LANGUAGE: ${language}
    USER_INPUT: ${prompt}
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

  return { data: output.courses, systemPrompt, usage, userPrompt };
}
