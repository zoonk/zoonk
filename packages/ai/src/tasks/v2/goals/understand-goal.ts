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
 * Flash Lite and Luna got every route and fact right on the understand-goal eval (7 Oct 2026);
 * Flash Lite answers in 1.6s p50 against Luna's 3.8s, the first wait a new learner sees.
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
  goal: string;
  language: string;
  /** For relative dates. */
  today: string;
};

export type UnderstandGoalParams = UnderstandGoalInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
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

/** Targets are the learner's own; nothing here is a promise. */
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

function toClassifierInput(input: UnderstandGoalInput): Record<string, string> {
  return { GOAL: input.goal };
}

/** Only the route: evaluation models can pick one but can't fill goals, dates or titles. */
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
