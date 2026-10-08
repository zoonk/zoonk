import "server-only";
import { Output, generateText, isStepCount } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { toCourseWeightsFinding } from "./course-weights-finding";
import systemPrompt from "./find-course-weights.prompt.md";
import {
  type ResearchSearchTool,
  buildResearchSearchTools,
  collectSearchedHosts,
  isOnSearchedHost,
} from "./research-search-tools";

export type { CourseWeightsFinding } from "./course-weights-finding";

/**
 * The pair `find-subject-questions` uses (Gemini 3.8 Flash with Parallel), at low reasoning: the
 * same kind of lookup, a table on a page a search returns, about two cents a goal.
 */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

/** A few searches and the answer. */
const MAX_STEPS = 5;

const schema = z.object({
  edition: z.string().nullable(),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  status: z.enum(["found", "unknown"]),
  weights: z.array(z.object({ subject: z.number().int(), weight: z.number() })),
});

type FindCourseWeightsInput = {
  /** The course the learner wants ("Medicina"). */
  course: string;
  /** The entrance exam ("ENEM"). */
  exam: string;
  /** The institution the learner wants ("UFMG"). */
  institution: string;
  /** The exam's parts as its notice names them. */
  subjects: string[];
  /** The learner-local date, YYYY-MM-DD. */
  today: string;
};

export type FindCourseWeightsParams = FindCourseWeightsInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  searchTool?: ResearchSearchTool;
};

function buildUserPrompt(input: FindCourseWeightsInput): string {
  return `
    TODAY: ${input.today}

${formatUntrustedInput({
  COURSE: input.course,
  EXAM: input.exam,
  INSTITUTION: input.institution,
  SUBJECTS: input.subjects.map((subject, index) => `${index + 1}. ${subject}`).join("\n"),
})}
  `;
}

/**
 * Looks up the weights the learner's course uses for each part of an entrance exam at the
 * learner's institution (Medicina at UFMG counts Natureza and the redação more), so the plan gives
 * those parts their share of the time and the learner sees why. Only one source's weights for one
 * selection, on a page a search returned, are kept; anything else reads as not known. Fallback
 * models aren't used: the search tool is tied to the model it's measured with.
 */
export async function findCourseWeights({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindCourseWeightsParams) {
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
    task: "find-course-weights",
  });

  const hosts = collectSearchedHosts({
    sources: result.sources,
    toolResults: result.steps.flatMap((step) => step.toolResults),
  });

  const data = toCourseWeightsFinding({
    isSearched: (url) => isOnSearchedHost({ hosts, url }),
    raw: result.output,
    subjectCount: input.subjects.length,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
