import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { COURSE_LEVELS } from "./_utils/course-levels";
import {
  EmptySkillGraphError,
  type SkillGraph,
  normalizeSkillGraph,
} from "./_utils/normalize-skill-graph";
import systemPrompt from "./skill-graph.prompt.md";

/**
 * From the skill-graph eval (6 cases, Astra judge, 26 Sep 2026): Opus 8.38,
 * Sol 8.29 and Gemini 3.8 Flash 7.57, at $236, $72 and $13 per 1,000 runs.
 * Sol is within the margin of Opus at under a third of the cost and faster;
 * Flash missed whole areas on huge goals, so it's only the last fallback.
 * Every model under-sized big goals, so the prompt gained size calibration;
 * Sol then scored 8.47 with honest totals (quantum physics from zero: 363 h).
 * Exam graphs put school subjects in the beginner band, so adults and students
 * finishing school opened on elementary chapters; with the level bands and the
 * schooling floor, Sol put ENEM and Polícia Federal Portuguese at intermediate
 * with no elementary skills (27 Sep: 7.9 and 8.3 on those two cases).
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

const schema = z.object({
  courses: z.array(
    z.object({ key: z.string(), levels: z.array(z.enum(COURSE_LEVELS)), title: z.string() }),
  ),
  phases: z.array(z.object({ milestone: z.string(), title: z.string() })),
  skills: z.array(
    z.object({
      course: z.string(),
      description: z.string(),
      estimatedLessons: z.number(),
      examWeight: z.number().nullable(),
      key: z.string(),
      level: z.enum(COURSE_LEVELS),
      name: z.string(),
      phase: z.number(),
      prerequisites: z.array(z.string()),
    }),
  ),
});

export type SkillGraphParams = {
  language: string;
  /** The goal in the learner's words. */
  goal: string;
  goalKind: "learn" | "exam" | "language";
  /** Why a learn goal: an overview, depth, work, a career change or a refresh. */
  purpose?: "overview" | "deep" | "work" | "careerChange" | "refresh";
  /** Where the learner says they are before placement. */
  ownLevel?: "none" | "basic" | "intermediate" | "advanced";
  /** Anything else the learner said: role, tasks, tools, reason, date, their material. */
  context?: string;
  /** The exam's areas, weights and how often the board asks each topic. */
  examBlueprint?: string;
  /** The language being learned, for language goals. */
  targetLanguage?: string;
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildUserPrompt(params: SkillGraphParams): string {
  const learnerInput = formatUntrustedInput({
    CONTEXT: params.context?.trim() || "none",
    GOAL: params.goal,
  });

  const targetLanguage = params.targetLanguage
    ? getPromptLanguageName({ language: params.targetLanguage, userLanguage: params.language })
    : "none";

  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
    GOAL_KIND: ${params.goalKind}
    PURPOSE: ${params.purpose ?? "none"}
    OWN_LEVEL: ${params.ownLevel ?? "none given"}
    TARGET_LANGUAGE: ${targetLanguage}
    EXAM_BLUEPRINT: ${params.examBlueprint?.trim() || "none"}

${learnerInput}
  `;
}

/**
 * Turns a goal into its skill graph: the skills it needs with their
 * prerequisites, the Library courses and level bands that teach them, and
 * the phases the learner goes through, each sized in hours of study rather
 * than dates. Huge goals span several courses; exam goals follow and weight
 * the blueprint when one is given.
 */
export async function generateSkillGraph(params: SkillGraphParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

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
      }),
    systemPrompt,
    task: "skill-graph",
  });

  const data: SkillGraph = normalizeSkillGraph(result.output);

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}

/** Whether a graph failed because the model answered with nothing to plan from. */
export function isEmptySkillGraphError(error: unknown): boolean {
  return error instanceof EmptySkillGraphError;
}
