import "server-only";
import { AI_TASK_MODEL_CONFIG } from "@zoonk/ai/tasks/metadata";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type ReasoningEffort, buildProviderOptions } from "../../provider-options";
import systemPrompt from "./alternative-titles.prompt.md";

const taskName = "alternative-titles";
const { defaultModel, fallbackModels } = AI_TASK_MODEL_CONFIG[taskName];

const schema = z.object({
  alternatives: z.array(z.string()),
});

export type AlternativeTitlesSchema = z.infer<typeof schema>;

export type AlternativeTitlesParams = {
  title: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

export async function generateAlternativeTitles({
  title,
  language,
  model = defaultModel,
  useFallback = true,
  reasoningEffort,
}: AlternativeTitlesParams) {
  const userPrompt = `
    TITLE: ${title}
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
