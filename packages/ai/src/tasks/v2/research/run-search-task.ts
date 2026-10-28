import "server-only";
import { Output, generateText, isStepCount } from "ai";
import { type z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import {
  type ResearchSearchTool,
  buildResearchSearchTools,
  collectSearchedHosts,
  isOnSearchedHost,
} from "./research-search-tools";

/**
 * A page on a site no search returned was invented, so a task keeps only what `isSearched` passes.
 * No fallback models: each search tool is tied to the model it's measured with.
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
        providerOptions: buildProviderOptions({ fallbackModels: [], model, useFallback: false }),
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
