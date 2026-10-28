import "server-only";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { type Reasoning } from "../../../provider-options";
import { toCourseWeightsFinding } from "./course-weights-finding";
import systemPrompt from "./find-course-weights.prompt.md";
import { type ResearchSearchTool } from "./research-search-tools";
import { runSearchTask } from "./run-search-task";

export type { CourseWeightsFinding } from "./course-weights-finding";

/** `find-subject-questions`'s pair for the same kind of lookup, at low reasoning. */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

const MAX_STEPS = 5;

const schema = z.object({
  edition: z.string().nullable(),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  status: z.enum(["found", "unknown"]),
  weights: z.array(z.object({ subject: z.number().int(), weight: z.number() })),
});

type FindCourseWeightsInput = {
  course: string;
  exam: string;
  institution: string;
  subjects: string[];
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

/** No fallback models: the search tool is tied to the model it's measured with. */
export async function findCourseWeights({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindCourseWeightsParams) {
  const userPrompt = buildUserPrompt(input);

  const { isSearched, output, provenance, usage } = await runSearchTask({
    analytics,
    maxSteps: MAX_STEPS,
    model,
    reasoning,
    schema,
    searchTool,
    systemPrompt,
    task: "find-course-weights",
    userPrompt,
  });

  const data = toCourseWeightsFinding({
    isSearched,
    raw: output,
    subjectCount: input.subjects.length,
  });

  return { data, provenance, systemPrompt, usage, userPrompt };
}
