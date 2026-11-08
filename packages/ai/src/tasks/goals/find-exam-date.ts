import "server-only";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type Reasoning } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { type ResearchSearchTool } from "../research/research-search-tools";
import { runSearchTask } from "../research/run-search-task";
import { toExamDateFinding } from "./exam-date-finding";
import systemPrompt from "./find-exam-date.prompt.md";

export type { ExamDateFinding } from "./exam-date-finding";

/**
 * With Parallel at low reasoning on 6 cases (8 Nov 2026), Haiku 5.5 and Luna each scored 10.00 (EN
 * and PT) at $6.14/1k and $6.45/1k, inside the 20/30 s wait; Flash scored 10.00 at $11.86/1k.
 */
const defaultModel = "anthropic/claude-haiku-5.5";
const fallbackModels = ["openai/gpt-6-luna"] as const;
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
  abortSignal?: AbortSignal;
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  searchTool?: ResearchSearchTool;
  useFallback?: boolean;
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

export async function findExamDate({
  abortSignal,
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  useFallback,
  ...input
}: FindExamDateParams) {
  const userPrompt = buildUserPrompt(input);

  const { isSearched, output, provenance, usage } = await runSearchTask({
    abortSignal,
    analytics,
    fallbackModels,
    maxSteps: MAX_STEPS,
    model,
    reasoning,
    schema,
    searchTool,
    systemPrompt,
    task: "find-exam-date",
    useFallback,
    userPrompt,
  });

  const data = toExamDateFinding({ isSearched, raw: output, today: input.today });

  return { data, provenance, systemPrompt, usage, userPrompt };
}
