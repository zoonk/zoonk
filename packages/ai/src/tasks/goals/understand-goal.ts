import "server-only";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { fillPromptLanguages, getPromptLanguageName } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import {
  type RawGoalUnderstanding,
  normalizeGoalUnderstanding,
} from "./normalize-goal-understanding";
import template from "./understand-goal.prompt.md";

export type { GoalUnderstanding, UnderstoodGoal } from "./normalize-goal-understanding";

/**
 * The first wait a new learner sees: Flash Lite passed every check on 53 of 58 goals in 1.59 s p50
 * at $1.41/1k (stored current-prompt run), Luna at minimal reasoning on 55 in 3.98 s at $0.16/1k,
 * and Haiku 5.5 without reasoning on 46, dropping a learner's second goal (8 Nov 2026).
 */
const defaultModel = "google/gemini-3.5-flash-lite";
const fallbackModels = ["openai/gpt-6-luna", "anthropic/claude-haiku-5.5"] as const;

/** Flat, with nullable fields, so every provider's structured output reads it the same way. */
const goalSchema = z.object({
  contentCountry: z.string().nullable(),
  countryDependent: z.boolean(),
  displayName: z.string(),
  examDay: z.enum(["official", "booked"]).nullable(),
  examMonth: z.number().nullable(),
  examName: z.string().nullable(),
  examSubjects: z.array(z.string()).nullable(),
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

type GoalMaterial = {
  /** What the learner chose to do with it; null when they didn't say. */
  intent: "exam" | "understand" | null;
  /** The learner's files, links or pasted text: whole when short, one line per page when long. */
  overview: string;
};

export type UnderstandGoalInput = {
  goal: string;
  language: string;
  material?: GoalMaterial | null;
  /** For relative dates. */
  today: string;
};

export type UnderstandGoalParams = UnderstandGoalInput & {
  dailyMinutesLimits: { min: number; max: number };
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
};

function getSystemPrompt({
  hasMaterial,
  language,
}: {
  hasMaterial: boolean;
  language: string;
}): string {
  return fillPromptLanguages({
    learnerLanguage: language,
    template: selectPromptVariants({ template, variants: { material: hasMaterial } }),
  });
}

function toUntrustedFields(input: UnderstandGoalInput): Record<string, string> {
  return input.material
    ? { GOAL: input.goal, MATERIAL: input.material.overview }
    : { GOAL: input.goal };
}

const DAYS_PER_WEEK = 7;
const WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long" });

/** A short test's date is usually a weekday ("on Friday"), which models count wrong from a date alone. */
function listComingDays(today: string): string {
  const start = Date.parse(`${today}T00:00:00Z`);

  return Array.from({ length: DAYS_PER_WEEK }, (_, index) => {
    const day = new Date(start + (index + 1) * MS_PER_DAY);
    return `${WEEKDAY.format(day)} ${day.toISOString().slice(0, 10)}`;
  }).join(", ");
}

function buildMaterialLines(input: UnderstandGoalInput): string {
  if (!input.material) {
    return "";
  }

  const intent = input.material.intent ? `\n    MATERIAL_INTENT: ${input.material.intent}` : "";
  return `\n    COMING_DAYS: ${listComingDays(input.today)}${intent}`;
}

function buildUserPrompt(input: UnderstandGoalInput): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: input.language })}
    TODAY: ${input.today}${buildMaterialLines(input)}

${formatUntrustedInput(toUntrustedFields(input))}
  `;
}

/** Targets are the learner's own; nothing here is a promise. */
export async function understandGoal(params: UnderstandGoalParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;
  const userPrompt = buildUserPrompt(params);

  const systemPrompt = getSystemPrompt({
    hasMaterial: Boolean(params.material),
    language: params.language,
  });

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

  const data = normalizeGoalUnderstanding({
    dailyMinutesLimits: params.dailyMinutesLimits,
    materialIntent: params.material?.intent ?? null,
    raw: result.output,
    today: params.today,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}

/** Only the route: evaluation models can pick one but can't fill goals, dates or titles. */
export const goalRouteClassifier = {
  instructions: selectPromptVariants({ template, variants: { material: false } }),
  labels: {
    explain: "A one-off question about how or why something works or what something means.",
    goals: "Something to study for: an exam, a language, a subject, a skill or a project.",
    instrument: "Learning to play a musical instrument or to sing.",
    unclear: "Doesn't say what to learn, or asks for something other than learning.",
    unsafe: "A harmful goal, gambling or cheating.",
  } satisfies Record<RawGoalUnderstanding["route"], string>,
  toInput: toUntrustedFields,
};
