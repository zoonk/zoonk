import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import {
  type RawGoalUnderstanding,
  normalizeGoalUnderstanding,
} from "./normalize-goal-understanding";
import systemPrompt from "./understand-goal.prompt.md";

export type { GoalUnderstanding, UnderstoodGoal } from "./normalize-goal-understanding";

/**
 * From the understand-goal eval (20 cases in English and Portuguese, code scoring, 27 Sep 2026):
 * Luna and Gemini 3.5 Flash Lite got every route and fact right (10.0); Luna is the cheapest at
 * $0.13 per 1,000 runs (p50 2.2s) against Flash Lite's $0.88 (p50 1.3s). Gemini 3.8 Flash split
 * "music theory and ear training" into two goals, Haiku called "write my essay" unsafe, and Jev
 * picks the route perfectly but can't fill the facts.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.5-flash-lite", "anthropic/claude-haiku-4.5"] as const;

/** Flat, with nullable fields, so every provider's structured output reads it the same way. */
const goalSchema = z.object({
  examName: z.string().nullable(),
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
  const { analytics, model = defaultModel, reasoning, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

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
