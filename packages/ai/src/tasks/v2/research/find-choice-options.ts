import "server-only";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { type Reasoning } from "../../../provider-options";
import { toChoiceOptionsFinding } from "./choice-options-finding";
import systemPrompt from "./find-choice-options.prompt.md";
import { type ResearchSearchTool } from "./research-search-tools";
import { runSearchTask } from "./run-search-task";

export type { ChoiceOptionsFinding } from "./choice-options-finding";

/** `find-subject-questions`'s pair, at low reasoning: a learner's placement may wait on it. */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

const MAX_STEPS = 4;

const schema = z.object({
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
};

function buildUserPrompt(input: FindChoiceOptionsInput): string {
  return `
    TODAY: ${input.today}

${formatUntrustedInput({ BOARD: input.board ?? "", EXAM: input.exam })}
  `;
}

/** No fallback models: the search tool is tied to the model it's measured with. */
export async function findChoiceOptions({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindChoiceOptionsParams) {
  const userPrompt = buildUserPrompt(input);

  const { isSearched, output, provenance, usage } = await runSearchTask({
    analytics,
    libraryInput: true,
    maxSteps: MAX_STEPS,
    model,
    reasoning,
    schema,
    searchTool,
    systemPrompt,
    task: "find-choice-options",
    userPrompt,
  });

  const data = toChoiceOptionsFinding({ isSearched, raw: output });

  return { data, provenance, systemPrompt, usage, userPrompt };
}
