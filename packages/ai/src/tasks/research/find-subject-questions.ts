import "server-only";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type Reasoning } from "../../provider-options";
import systemPrompt from "./find-subject-questions.prompt.md";
import { type ResearchSearchTool } from "./research-search-tools";
import { runSearchTask } from "./run-search-task";
import { toSubjectQuestionsFinding } from "./subject-questions-finding";

export type { SubjectQuestionsFinding } from "./subject-questions-finding";

/**
 * At low reasoning, since a plan waits on it: on 8 cases run twice (11 Nov 2026), Luna scored 9.75
 * (missing one run of the new-board case) and Flash 10.00, at $10.59/1k and $17.23/1k.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash"] as const;
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

const MAX_STEPS = 5;

const schema = z.object({
  board: z.string().nullable(),
  counts: z.array(z.object({ questions: z.number().int(), subject: z.number().int() })),
  edition: z.string().nullable(),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  status: z.enum(["found", "unknown"]),
  unlistedSubjects: z.array(z.object({ name: z.string(), questions: z.number().int() })),
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
  useFallback?: boolean;
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

export async function findSubjectQuestions({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  useFallback,
  ...input
}: FindSubjectQuestionsParams) {
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
    task: "find-subject-questions",
    useFallback,
    userPrompt,
  });

  const data = toSubjectQuestionsFinding({
    board: input.board,
    isSearched,
    raw: output,
    subjectCount: input.subjects.length,
    total: input.total,
  });

  return { data, provenance, systemPrompt, usage, userPrompt };
}
