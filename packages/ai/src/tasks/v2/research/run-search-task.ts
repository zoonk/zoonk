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
 * Runs a task that searches the web with `searchTool` and answers in `schema`. `isSearched` says
 * whether an address is on a site its searches returned: a page on any other site was invented by
 * the model, so a task keeps only what a search showed. Fallback models aren't used: each search
 * tool is tied to the model it's measured with.
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
