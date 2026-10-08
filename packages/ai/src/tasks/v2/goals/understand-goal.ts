import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import {
  type RawGoalUnderstanding,
  normalizeGoalUnderstanding,
} from "./normalize-goal-understanding";
import systemPrompt from "./understand-goal.prompt.md";

export type { GoalUnderstanding, UnderstoodGoal } from "./normalize-goal-understanding";

/**
 * From the understand-goal eval (37 cases in English and Portuguese, code scoring, 7 Oct 2026):
 * Gemini 3.5 Flash Lite and Luna got every route and fact right; Flash Lite answers in 1.6s (p50,
 * 2.0s p95) against Luna's 3.8s (6.3s p95), the first wait a new learner sees, at $1.21 per 1,000
 * runs against $0.17 on a provider we hold credits for. Gemini 3.8 Flash split "music theory and
 * ear training" into two goals, Haiku called "write my essay" unsafe, and Jev picks the route
 * perfectly but can't fill the facts. Claude Haiku 5.5 with thinking off got 33 of 37 fully right
 * at p50 2.3s and $0.41 (7 Oct 2026), slower and less exact than Flash Lite.
 */
const defaultModel = "google/gemini-3.5-flash-lite";
const fallbackModels = ["openai/gpt-6-luna", "anthropic/claude-haiku-5.5"] as const;

/** Flat, with nullable fields, so every provider's structured output reads it the same way. */
const goalSchema = z.object({
  examMonth: z.number().nullable(),
  examName: z.string().nullable(),
  examTarget: z.enum(["admission", "score", "position"]).nullable(),
  examYear: z.number().nullable(),
  institution: z.string().nullable(),
  kind: z.enum(["learn", "exam", "language"]),
  level: z.string().nullable(),
  nativeLanguage: z.string().nullable(),
  ownLevel: z.enum(["none", "basic", "intermediate", "advanced"]).nullable(),
  purpose: z.enum(["overview", "deep", "work", "careerChange", "refresh", "other"]).nullable(),
  reason: z.string().nullable(),
  role: z.string().nullable(),
  subject: z.string(),
  targetCourse: z.string().nullable(),
  targetDate: z.string().nullable(),
  targetLanguage: z.string().nullable(),
  targetPosition: z.string().nullable(),
  targetScore: z.string().nullable(),
  title: z.string(),
});

const schema = z.object({
  dailyMinutes: z.number().nullable(),
  followUps: z.array(z.string()),
  goals: z.array(goalSchema),
  instrument: z.string().nullable(),
  question: z.string().nullable(),
  route: z.enum(["goals", "explain", "instrument", "unsafe", "unclear"]),
  studyDays: z.array(z.number()).nullable(),
  studyTime: z.string().nullable(),
  studyTimeNote: z.string().nullable(),
}) satisfies z.ZodType<RawGoalUnderstanding>;

export type UnderstandGoalInput = {
  /** What the learner typed. */
  goal: string;
  /** The learner's language, for titles and notes. */
  language: string;
  /** The learner-local date, YYYY-MM-DD, for relative dates. */
  today: string;
};

export type UnderstandGoalParams = UnderstandGoalInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  /** The gateway tier it answers at (see `chooseServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
};

function buildUserPrompt(input: UnderstandGoalInput): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: input.language })}
    TODAY: ${input.today}

${formatUntrustedInput({ GOAL: input.goal })}
  `;
}

/**
 * Reads a goal typed in the learner's own words: what kind of request it is (goals to plan, a
 * quick explanation, an instrument, something unsafe or unclear) and every onboarding answer the
 * text already gives (exam, dates, target, level, reason, purpose, role and when they study), so
 * onboarding only asks what's missing. Targets are the learner's own; nothing here is a promise.
 */
export async function understandGoal(params: UnderstandGoalParams) {
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
    task: "understand-goal",
  });

  const data = normalizeGoalUnderstanding({ raw: result.output, today: params.today });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}

/** The request as an evaluation-model state, so evals can compare Jev on the route alone. */
function toClassifierInput(input: UnderstandGoalInput): Record<string, string> {
  return { GOAL: input.goal };
}

/**
 * Only the route, as an evaluation question: evaluation models can pick a route but can't fill
 * goals, dates or titles.
 */
export const goalRouteClassifier = {
  instructions: systemPrompt,
  labels: {
    explain: "A one-off question about how or why something works or what something means.",
    goals: "Something to study for: an exam, a language, a subject, a skill or a project.",
    instrument: "Learning to play a musical instrument or to sing.",
    unclear: "Doesn't say what to learn, or asks for something other than learning.",
    unsafe: "A harmful goal, gambling or cheating.",
  } satisfies Record<RawGoalUnderstanding["route"], string>,
  toInput: toClassifierInput,
};
