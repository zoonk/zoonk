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

/** `find-course-weights`'s pair for the same kind of lookup, at low reasoning. */
const defaultModel = "google/gemini-3.8-flash";
const defaultSearchTool: ResearchSearchTool = "parallel";
const defaultReasoning: Reasoning = "low";

const MAX_STEPS = 5;

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
  /** Null for a position. */
  course: string | null;
  exam: string;
  institution: string | null;
  position: string | null;
  today: string;
};

export type FindTargetCutoffParams = FindTargetCutoffInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  searchTool?: ResearchSearchTool;
};

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

/** No fallback models: the search tool is tied to the model it's measured with. */
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
