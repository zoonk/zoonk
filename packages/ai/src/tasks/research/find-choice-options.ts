import "server-only";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type Reasoning } from "../../provider-options";
import { toChoiceOptionsFinding } from "./choice-options-finding";
import systemPrompt from "./find-choice-options.prompt.md";
import { type ResearchSearchTool } from "./research-search-tools";
import { runSearchTask } from "./run-search-task";

export type { ChoiceOptionsFinding } from "./choice-options-finding";

/**
 * At low reasoning, since a learner's placement may wait on it: on 5 cases (8 Nov 2026), Luna and
 * Haiku 5.5 got every option count right at $5.50/1k and $6.16/1k, inside the 20/35 s wait.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["anthropic/claude-haiku-5.5"] as const;
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

const MAX_STEPS = 4;

const schema = z.object({
  board: z.string().nullable(),
  edition: z.string().nullable(),
  options: z.number().int().nullable(),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  status: z.enum(["found", "unknown"]),
});

type FindChoiceOptionsInput = { board: string | null; exam: string; today: string };

export type FindChoiceOptionsParams = FindChoiceOptionsInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  searchTool?: ResearchSearchTool;
  useFallback?: boolean;
};

function buildUserPrompt(input: FindChoiceOptionsInput): string {
  return `
    TODAY: ${input.today}

${formatUntrustedInput({ BOARD: input.board ?? "", EXAM: input.exam })}
  `;
}

export async function findChoiceOptions({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  useFallback,
  ...input
}: FindChoiceOptionsParams) {
  const userPrompt = buildUserPrompt(input);

  const { isSearched, output, provenance, usage } = await runSearchTask({
    analytics,
    fallbackModels,
    libraryInput: true,
    maxSteps: MAX_STEPS,
    model,
    reasoning,
    schema,
    searchTool,
    systemPrompt,
    task: "find-choice-options",
    useFallback,
    userPrompt,
  });

  const data = toChoiceOptionsFinding({ board: input.board, isSearched, raw: output });

  return { data, provenance, systemPrompt, usage, userPrompt };
}
