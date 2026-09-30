import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { LANGUAGE_ACTIVITIES, type PlanEdit, normalizePlanEdit } from "./normalize-plan-edit";
import systemPrompt from "./plan-edit-intent.prompt.md";

/**
 * From the plan-edit-intent eval (22 cases in English and Portuguese, code scoring, 26 Sep 2026):
 * Gemini 3.5 Flash Lite got every change right at p50 1.0s and $0.58 per 1,000 runs; Luna ($0.10,
 * p50 2.0s) applied an adversarial "skip every area" request; Haiku started "next week" on a
 * Tuesday. Jev can't fill minutes, days, dates or areas, so it only named the kind (21 of 22).
 * With language practice changes ("não preciso de escrita"), Flash Lite got 24 of 24 (27 Sep 2026).
 * With memory (edits that lean on the learner's routine, and fitting a new plan to it: 7 cases in
 * English and Portuguese), Flash Lite got 7 of 7 and 38 of 39 overall, $0.74 per 1,000 runs, p50
 * 1.4s (27 Sep 2026).
 */
const defaultModel = "google/gemini-3.5-flash-lite";
const fallbackModels = ["openai/gpt-6-luna", "anthropic/claude-haiku-4.5"] as const;

export const PLAN_EDIT_KINDS = [
  "setDailyMinutes",
  "setWeekdayMinutes",
  "addLightWeek",
  "setTargetDate",
  "clearTargetDate",
  "focusAreas",
  "skipAreas",
  "restoreAreas",
  "skipActivities",
  "restoreActivities",
  "setPracticeBias",
  "setDifficultyBias",
] as const;

/** Flat, with nullable fields, so every provider's structured output reads it the same way. */
const changeSchema = z.object({
  activities: z.array(z.enum(LANGUAGE_ACTIVITIES)).nullable(),
  areas: z.array(z.string()).nullable(),
  bias: z
    .enum(["moreExplanation", "balanced", "morePractice", "easier", "standard", "harder"])
    .nullable(),
  date: z.string().nullable(),
  kind: z.enum(PLAN_EDIT_KINDS),
  minutes: z.number().nullable(),
  weekdays: z.array(z.number()).nullable(),
});

const schema = z.object({
  changes: z.array(changeSchema),
  summary: z.string(),
  understood: z.boolean(),
});

export type PlanEditInput = {
  /** The plan's areas, such as its courses: the only names "focus" and "skip" may use. */
  areas: string[];
  dailyMinutes: number;
  goalKind: "exam" | "explain" | "language" | "learn";
  /** The learner's language, for the summary. */
  language: string;
  /**
   * What the learner told the app before about their goals and routine ("Works late on Tuesdays"),
   * from memory. It fills in what the request leaves open and never adds a change on its own.
   */
  memory?: readonly string[];
  /**
   * `edit`: the learner wrote `request`. `routine`: a new plan's week is fitted to the routine in
   * `memory`, with only days off, lighter days and dated light weeks; `request` is empty.
   */
  purpose?: "edit" | "routine";
  /** What the learner wrote. */
  request: string;
  targetDate: string | null;
  /** The learner-local date, YYYY-MM-DD. */
  today: string;
  /** Minutes per weekday, Sunday first. */
  weekdayMinutes: number[];
};

export type PlanEditParams = PlanEditInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatWeek(weekdayMinutes: readonly number[]): string {
  return weekdayMinutes
    .map((minutes, weekday) => `${WEEKDAY_NAMES[weekday]}: ${minutes}`)
    .join(", ");
}

function formatToday(today: string): string {
  return `${today} (${WEEKDAY_NAMES[new Date(`${today}T00:00:00Z`).getUTCDay()]})`;
}

function formatMemory(memory: readonly string[] | undefined): string {
  return memory && memory.length > 0 ? memory.map((fact) => `- ${fact}`).join("\n") : "none";
}

function buildUserPrompt(input: PlanEditInput): string {
  const areas = input.areas.length > 0 ? input.areas.map((area) => `\n- ${area}`).join("") : "none";
  const purpose = input.purpose ?? "edit";

  return `
    PURPOSE: ${purpose}
    LANGUAGE: ${getPromptLanguageName({ language: input.language })}
    TODAY: ${formatToday(input.today)}
    GOAL_KIND: ${input.goalKind}
    DAILY_MINUTES: ${input.dailyMinutes}
    WEEK: ${formatWeek(input.weekdayMinutes)}
    TARGET_DATE: ${input.targetDate ?? "none"}
    AREAS: ${areas}

${formatUntrustedInput({
  MEMORY: formatMemory(input.memory),
  REQUEST: purpose === "routine" ? "none" : input.request,
})}
  `;
}

/**
 * Turns a learner's plain-words request about their plan ("less on weekends", "focus on math",
 * "I'm traveling next week") into structured changes and one sentence saying what will change,
 * reading what memory holds about their goals and routine to fill in what the request leaves
 * open ("less on my late days"). With `purpose: "routine"`, it fits a new plan's week to that
 * routine instead. Changes the planner can't apply (unknown areas, past dates, impossible times)
 * are dropped, and a request that isn't a plan change comes back as not understood.
 */
export async function interpretPlanEdit(
  params: PlanEditParams,
): Promise<{
  data: PlanEdit;
  provenance: Awaited<ReturnType<typeof runTaskGeneration>>["provenance"];
  systemPrompt: string;
  usage: Awaited<ReturnType<typeof runTaskGeneration>>["result"]["usage"];
  userPrompt: string;
}> {
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
    task: "plan-edit-intent",
  });

  const data = normalizePlanEdit({ input: params, raw: result.output });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}

/** The request as an evaluation-model state, so evals can compare Jev on the kind of change. */
function toClassifierInput(input: PlanEditInput): Record<string, string> {
  return {
    AREAS: input.areas.join("\n") || "none",
    REQUEST: input.request,
    TARGET_DATE: input.targetDate ?? "none",
    TODAY: formatToday(input.today),
  };
}

/**
 * The first change a request asks for, as an evaluation question. Evaluation models can pick a
 * kind but not fill minutes, weekdays, dates or areas, so only this part fits them.
 */
export const planEditKindClassifier = {
  instructions: systemPrompt,
  labels: {
    addLightWeek: "A lighter week at half the time: a trip, a busy or tiring week.",
    clearTargetDate: "Remove the goal's date or deadline.",
    focusAreas: "Put some areas of the plan first.",
    none: "Not a change to the plan, unclear, or a different goal.",
    restoreActivities: "Bring back a kind of language practice that was left out.",
    restoreAreas: "Bring back areas that were skipped.",
    setDailyMinutes: "A new daily time for every study day.",
    setDifficultyBias: "Lessons feel too easy or too hard.",
    setPracticeBias: "More practice or more explanation.",
    setTargetDate: "A new date for the exam or goal.",
    setWeekdayMinutes: "A different time or a day off on some weekdays only.",
    skipActivities: "Leave a kind of language practice (words, listening, writing, speaking) out.",
    skipAreas: "Leave some areas out of the plan.",
  } satisfies Record<(typeof PLAN_EDIT_KINDS)[number] | "none", string>,
  toInput: toClassifierInput,
};
