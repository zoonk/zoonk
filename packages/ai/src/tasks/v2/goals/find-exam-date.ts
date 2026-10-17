import "server-only";
import { Output, generateText, isStepCount } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import {
  type ResearchSearchTool,
  buildResearchSearchTools,
  collectSearchedHosts,
  isOnSearchedHost,
} from "../research/research-search-tools";
import { toExamDateFinding } from "./exam-date-finding";
import systemPrompt from "./find-exam-date.prompt.md";

export type { ExamDateFinding } from "./exam-date-finding";

/**
 * The pair `find-official-sources` measured best at finding a current notice (Gemini 3.8 Flash with
 * Parallel). On the `find-exam-date` eval (5 real exams, 6 Oct 2026) it read every published day
 * from an official page and gave none for a notice not out yet or a test learners book (10.0);
 * low reasoning brought the published notices from 33–38s to 15–20s at the same score, about $0.02
 * a lookup.
 */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

/** A few searches and the answer: the learner is waiting on the card. */
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
  /** The learner's language, for the dates' labels. */
  language: string;
  role: string | null;
  /** The learner-local date, YYYY-MM-DD: only an edition ahead of it counts. */
  today: string;
  /** What the learner typed, for the edition they mean ("the first phase in March"). */
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

/**
 * Looks up the official day of the next edition of an exam a learner just named, with the page it
 * was read from, while they read what onboarding understood. Only an official, current source
 * counts: a date that's past, unsourced or on a site no search returned is dropped, and the exam
 * reads as not known yet instead of guessed. Research still reads the whole notice once the goal
 * exists. Fallback models aren't used: the search tool is tied to the model it's measured with.
 */
export async function findExamDate({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindExamDateParams) {
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
    task: "find-exam-date",
  });

  const hosts = collectSearchedHosts({
    sources: result.sources,
    toolResults: result.steps.flatMap((step) => step.toolResults),
  });

  const data = toExamDateFinding({
    isSearched: (url) => isOnSearchedHost({ hosts, url }),
    raw: result.output,
    today: input.today,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
