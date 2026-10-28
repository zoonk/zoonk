import "server-only";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { type Reasoning } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type ResearchSearchTool } from "../research/research-search-tools";
import { runSearchTask } from "../research/run-search-task";
import { toExamDateFinding } from "./exam-date-finding";
import systemPrompt from "./find-exam-date.prompt.md";

export type { ExamDateFinding } from "./exam-date-finding";

/**
 * With Parallel, it scored 10.0 on the `find-exam-date` eval (6 Oct 2026); low reasoning halved
 * the time at the same score.
 */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

/** The learner is waiting on the card. */
const MAX_STEPS = 5;

const schema = z.object({
  dates: z.array(z.object({ date: z.string(), label: z.string() })),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  status: z.enum(["official", "notPublished", "unknown"]),
});

type FindExamDateInput = {
  exam: string;
  institution: string | null;
  language: string;
  role: string | null;
  /** Only an edition ahead of it counts. */
  today: string;
  words: string | null;
  year: number | null;
};

export type FindExamDateParams = FindExamDateInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  searchTool?: ResearchSearchTool;
};

function buildUserPrompt(input: FindExamDateInput): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: input.language })}
    TODAY: ${input.today}

${formatUntrustedInput({
  EXAM: input.exam,
  INSTITUTION: input.institution ?? "",
  ROLE: input.role ?? "",
  WORDS: input.words ?? "",
  YEAR: input.year === null ? "" : String(input.year),
})}
  `;
}

/** No fallback models: the search tool is tied to the model it's measured with. */
export async function findExamDate({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindExamDateParams) {
  const userPrompt = buildUserPrompt(input);

  const { isSearched, output, provenance, usage } = await runSearchTask({
    analytics,
    maxSteps: MAX_STEPS,
    model,
    reasoning,
    schema,
    searchTool,
    systemPrompt,
    task: "find-exam-date",
    userPrompt,
  });

  const data = toExamDateFinding({ isSearched, raw: output, today: input.today });

  return { data, provenance, systemPrompt, usage, userPrompt };
}
