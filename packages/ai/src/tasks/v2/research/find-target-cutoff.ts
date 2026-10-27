import "server-only";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { type Reasoning } from "../../../provider-options";
import coursePrompt from "./find-target-cutoff-course.prompt.md";
import positionPrompt from "./find-target-cutoff-position.prompt.md";
import basePrompt from "./find-target-cutoff.prompt.md";
import { type ResearchSearchTool } from "./research-search-tools";
import { runSearchTask } from "./run-search-task";
import { toTargetCutoffFinding } from "./target-cutoff-finding";

export type { TargetCutoffFinding } from "./target-cutoff-finding";

/**
 * The pair `find-course-weights` uses (Gemini 3.8 Flash with Parallel), at low reasoning: the same
 * kind of lookup, one number on a page a search returns, about two cents a target, once a year.
 */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

/** A few searches and the answer. */
const MAX_STEPS = 5;

/** Each call reads how to search for its own kind of target only. */
const courseSystemPrompt = `${basePrompt}\n${coursePrompt}`;
const positionSystemPrompt = `${basePrompt}\n${positionPrompt}`;

const schema = z.object({
  edition: z.string().nullable(),
  maxScore: z.number().nullable(),
  quota: z.string().nullable(),
  score: z.number().nullable(),
  sourceTitle: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  status: z.enum(["found", "unknown"]),
});

type FindTargetCutoffInput = {
  /** The course the learner wants ("Medicina"), or null for a position. */
  course: string | null;
  /** The exam, with the role it's for when it has one ("ENEM"). */
  exam: string;
  /** The institution the learner wants ("UFMG"), or null. */
  institution: string | null;
  /** The position the learner wants in a public-service exam, or null. */
  position: string | null;
  /** The learner-local date, YYYY-MM-DD. */
  today: string;
};

export type FindTargetCutoffParams = FindTargetCutoffInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  searchTool?: ResearchSearchTool;
};

/** The target's own inputs only: a course's call never reads `POSITION`, nor a position's `COURSE`. */
function formatTarget(input: FindTargetCutoffInput): Record<string, string> {
  const { position } = input;

  if (position !== null) {
    return {
      EXAM: input.exam,
      ...(input.institution ? { INSTITUTION: input.institution } : {}),
      POSITION: position,
    };
  }

  return {
    COURSE: input.course ?? "none",
    EXAM: input.exam,
    INSTITUTION: input.institution ?? "none",
  };
}

function buildUserPrompt(input: FindTargetCutoffInput): string {
  return `
    TODAY: ${input.today}

${formatUntrustedInput(formatTarget(input))}
  `;
}

/**
 * Looks up the last published cut-off of the learner's target, for the general list: a course at
 * an institution that selects by the exam's score (SISU's last cut-off for Medicina at UFMG), or a
 * public-service exam's position, so the learner sees where the bar was next to their own goal.
 * Only one source's cut-off for that exact target, on a page a search returned, is kept; anything
 * else reads as not known. Fallback models aren't used: the search tool is tied to the model it's
 * measured with.
 */
export async function findTargetCutoff({
  analytics,
  model = defaultModel,
  reasoning = defaultReasoning,
  searchTool = defaultSearchTool,
  ...input
}: FindTargetCutoffParams) {
  const userPrompt = buildUserPrompt(input);
  // A target is a course at an institution or a position (see `getCutoffTarget`), never both.
  const systemPrompt = input.position === null ? courseSystemPrompt : positionSystemPrompt;

  const { isSearched, output, provenance, usage } = await runSearchTask({
    analytics,
    maxSteps: MAX_STEPS,
    model,
    reasoning,
    schema,
    searchTool,
    systemPrompt,
    task: "find-target-cutoff",
    userPrompt,
  });

  const data = toTargetCutoffFinding({ isSearched, raw: output });

  return { data, provenance, systemPrompt, usage, userPrompt };
}
