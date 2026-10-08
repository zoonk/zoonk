import "server-only";
import { Output, generateText, isStepCount } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import systemPrompt from "./find-subject-questions.prompt.md";
import {
  type ResearchSearchTool,
  buildResearchSearchTools,
  collectSearchedHosts,
  isOnSearchedHost,
} from "./research-search-tools";
import { toSubjectQuestionsFinding } from "./subject-questions-finding";

export type { SubjectQuestionsFinding } from "./subject-questions-finding";

/**
 * The pair `find-official-sources` and `find-exam-date` measured best at reading a page a search
 * returns (Gemini 3.8 Flash with Parallel), at low reasoning: a learner's plan waits on it.
 */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

/** A few searches and the answer. */
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
  /** The exam and, when it has phases or roles, the learner's ("OAB…, 1ª fase"). */
  exam: string;
  subjects: string[];
  /** The learner-local date, YYYY-MM-DD. */
  today: string;
  /** The exam's questions when the notice gives them: the counts must add up to it. */
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

/**
 * Looks up how many questions each of an exam's subjects got in its latest editions, for a notice
 * that names its subjects without their counts (the OAB's 1ª fase): candidates study the subjects
 * that get the most questions first, and the plan weighs them the same way. Only one source's
 * counts for one edition, adding up to the exam's total, on a page a search returned, are kept;
 * anything else reads as not known. Fallback models aren't used: the search tool is tied to the
 * model it's measured with.
 */
export async function findSubjectQuestions({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindSubjectQuestionsParams) {
  const userPrompt = buildUserPrompt(input);
  const providerOptions = buildProviderOptions({ fallbackModels: [], model, useFallback: false });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
        stopWhen: isStepCount(MAX_STEPS),
        tools: buildResearchSearchTools({ model, searchTool }),
      }),
    promptVersion: `search:${searchTool}`,
    systemPrompt,
    task: "find-subject-questions",
  });

  const hosts = collectSearchedHosts({
    sources: result.sources,
    toolResults: result.steps.flatMap((step) => step.toolResults),
  });

  const data = toSubjectQuestionsFinding({
    isSearched: (url) => isOnSearchedHost({ hosts, url }),
    raw: result.output,
    subjectCount: input.subjects.length,
    total: input.total,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
