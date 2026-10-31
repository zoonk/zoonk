import "server-only";
import { Output, generateText, isStepCount } from "ai";
import { type z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import {
  type ResearchSearchTool,
  buildResearchSearchTools,
  collectSearchedHosts,
  isOnSearchedHost,
} from "./research-search-tools";

const fallbackModels = ["openai/gpt-6.1-terra"] as const;

/**
 * A page on a site no search returned was invented, so a task keeps only what `isSearched` passes.
 */
export async function runSearchTask<T>({
  analytics,
  libraryInput,
  maxSteps,
  model,
  reasoning,
  schema,
  searchTool,
  systemPrompt,
  task,
  useFallback = true,
  userPrompt,
}: {
  analytics?: AiGenerationContext;
  /** The prompt holds public documents alone (see `runTaskGeneration`). */
  libraryInput?: boolean;
  maxSteps: number;
  model: string;
  reasoning?: Reasoning;
  schema: z.ZodType<T>;
  searchTool: ResearchSearchTool;
  systemPrompt: string;
  task: string;
  useFallback?: boolean;
  userPrompt: string;
}) {
  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions: buildProviderOptions({
          fallbackModels,
          model,
          // A `native` search tool belongs to the requested model's provider alone.
          useFallback: useFallback && searchTool !== "native",
        }),
        reasoning,
        stopWhen: isStepCount(maxSteps),
        tools: buildResearchSearchTools({ model, searchTool }),
      }),
    libraryInput,
    promptVersion: `search:${searchTool}`,
    systemPrompt,
    task,
  });

  const hosts = collectSearchedHosts({
    sources: result.sources,
    toolResults: result.steps.flatMap((step) => step.toolResults),
  });

  return {
    isSearched: (url: string) => isOnSearchedHost({ hosts, url }),
    output: result.output,
    provenance,
    searchCalls: result.steps.flatMap((step) => step.toolCalls).length,
    usage: result.usage,
  };
}
