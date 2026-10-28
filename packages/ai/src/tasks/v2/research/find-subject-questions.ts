import "server-only";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { type Reasoning } from "../../../provider-options";
import systemPrompt from "./find-subject-questions.prompt.md";
import { type ResearchSearchTool } from "./research-search-tools";
import { runSearchTask } from "./run-search-task";
import { toSubjectQuestionsFinding } from "./subject-questions-finding";

export type { SubjectQuestionsFinding } from "./subject-questions-finding";

/**
 * The pair measured best at reading a page a search returns, at low reasoning: a plan waits on it.
 */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

const MAX_STEPS = 5;

const schema = z.object({
  counts: z.array(z.object({ questions: z.number().int(), subject: z.number().int() })),
  edition: z.string().nullable(),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  status: z.enum(["found", "unknown"]),
});

type FindSubjectQuestionsInput = {
  board: string | null;
  exam: string;
  subjects: string[];
  today: string;
  /** The counts must add up to it. */
  total: number | null;
};

export type FindSubjectQuestionsParams = FindSubjectQuestionsInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  searchTool?: ResearchSearchTool;
};

function buildUserPrompt(input: FindSubjectQuestionsInput): string {
  return `
    TODAY: ${input.today}

${formatUntrustedInput({
  BOARD: input.board ?? "",
  EXAM: input.exam,
  SUBJECTS: input.subjects.map((subject, index) => `${index + 1}. ${subject}`).join("\n"),
  TOTAL: input.total === null ? "" : String(input.total),
})}
  `;
}

/** No fallback models: the search tool is tied to the model it's measured with. */
export async function findSubjectQuestions({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindSubjectQuestionsParams) {
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
    task: "find-subject-questions",
    userPrompt,
  });

  const data = toSubjectQuestionsFinding({
    isSearched,
    raw: output,
    subjectCount: input.subjects.length,
    total: input.total,
  });

  return { data, provenance, systemPrompt, usage, userPrompt };
}
