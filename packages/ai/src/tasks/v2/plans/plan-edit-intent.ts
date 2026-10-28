import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import {
  AREA_STARTS,
  LANGUAGE_ACTIVITIES,
  type PlanEdit,
  type PlanEditSkill,
  WRITTEN_CADENCES,
  normalizePlanEdit,
  toSkillKey,
} from "./normalize-plan-edit";
import systemPrompt from "./plan-edit-intent.prompt.md";
import { formatMemory, formatToday, formatWeek } from "./plan-prompt-format";

/**
 * Flash Lite got 47 of 49 plan-edit-intent cases at 1.4s p50 (7 Oct 2026). Luna applied an
 * adversarial "skip every area" request, and Haiku matched Flash Lite with a looser tail while
 * learners wait.
 */
const defaultModel = "google/gemini-3.5-flash-lite";
const fallbackModels = ["anthropic/claude-haiku-5.5", "openai/gpt-6-luna"] as const;

export { type PlanEditTopic } from "./plan-edit-topics";

export const PLAN_EDIT_KINDS = [
  "setDailyMinutes",
  "setWeekdayMinutes",
  "addLightWeek",
  "setTargetDate",
  "clearTargetDate",
  "focusAreas",
  "reduceAreas",
  "skipAreas",
  "restoreAreas",
  "skipActivities",
  "restoreActivities",
  "setPracticeBias",
  "setDifficultyBias",
  "setAreaStart",
  "setWrittenCadence",
  "addTopics",
] as const;

/** Flat, with nullable fields, so every provider's structured output reads it the same way. */
const changeSchema = z.object({
  activities: z.array(z.enum(LANGUAGE_ACTIVITIES)).nullable(),
  areas: z.array(z.string()).nullable(),
  bias: z
    .enum(["moreExplanation", "balanced", "morePractice", "easier", "standard", "harder"])
    .nullable(),
  cadence: z.enum(WRITTEN_CADENCES).nullable(),
  date: z.string().nullable(),
  kind: z.enum(PLAN_EDIT_KINDS),
  minutes: z.number().nullable(),
  parts: z
    .array(z.object({ area: z.string(), name: z.string(), skills: z.array(z.string()) }))
    .nullable(),
  start: z.enum(AREA_STARTS).nullable(),
  topics: z
    .array(z.object({ area: z.string().nullable(), description: z.string(), name: z.string() }))
    .nullable(),
  weekdays: z.array(z.number()).nullable(),
});

const schema = z.object({
  changes: z.array(changeSchema),
  leftOut: z.array(z.string()),
  summary: z.string(),
  understood: z.boolean(),
});

export type PlanEditInput = {
  /** The only names "focus" and "skip" may use. */
  areas: string[];
  dailyMinutes: number;
  goalKind: "exam" | "explain" | "language" | "learn";
  language: string;
  /** It fills in what the request leaves open and never adds a change on its own. */
  memory?: readonly string[];
  request: string;
  /** So a focus can name part of an area; without them, focuses take whole areas. */
  skills?: readonly PlanEditSkill[];
  targetDate: string | null;
  today: string;
  /** Sunday first. */
  weekdayMinutes: number[];
  writtenParts?: readonly string[];
};

export type PlanEditParams = PlanEditInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

function formatAreas(input: PlanEditInput): string {
  if (input.areas.length === 0) {
    return "none";
  }

  const skills = (input.skills ?? []).map((skill, index) => ({ ...skill, key: toSkillKey(index) }));

  return input.areas
    .map((area) =>
      [
        `\n- ${area}`,
        ...skills
          .filter((skill) => skill.area === area)
          .map((skill) => `\n  ${skill.key} ${skill.name}`),
      ].join(""),
    )
    .join("");
}

function buildUserPrompt(input: PlanEditInput): string {
  const areas = formatAreas(input);

  return `
    LANGUAGE: ${getPromptLanguageName({ language: input.language })}
    TODAY: ${formatToday(input.today)}
    GOAL_KIND: ${input.goalKind}
    DAILY_MINUTES: ${input.dailyMinutes}
    WEEK: ${formatWeek(input.weekdayMinutes)}
    TARGET_DATE: ${input.targetDate ?? "none"}
    AREAS: ${areas}
    WRITTEN_PARTS: ${input.writtenParts?.length ? input.writtenParts.join(", ") : "none"}

${formatUntrustedInput({ MEMORY: formatMemory(input.memory), REQUEST: input.request })}
  `;
}

/**
 * A request that isn't a plan change comes back as not understood. Parts no change covers ("and
 * aim for 800") come back as `leftOut`, so whoever asked can answer them instead of dropping them.
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

function toClassifierInput(input: PlanEditInput): Record<string, string> {
  return {
    AREAS: input.areas.join("\n") || "none",
    REQUEST: input.request,
    TARGET_DATE: input.targetDate ?? "none",
    TODAY: formatToday(input.today),
  };
}

/** Evaluation models can pick a kind but not fill minutes, weekdays, dates or areas. */
export const planEditKindClassifier = {
  instructions: systemPrompt,
  labels: {
    addLightWeek: "A lighter week at half the time: a trip, a busy or tiring week.",
    addTopics:
      "Add topics or a project the plan doesn't teach yet, such as more of the learner's field or a portfolio project.",
    clearTargetDate: "Remove the goal's date or deadline.",
    focusAreas: "More time and depth for some areas of the plan, which come first.",
    none: "Not a change to the plan, unclear, or a different goal.",
    reduceAreas: "Less time for some areas the learner wants less of, which stay in the plan.",
    restoreActivities: "Bring back a kind of language practice that was left out.",
    restoreAreas:
      "Bring back areas that were skipped, or give areas with less time their usual time.",
    setAreaStart:
      "Some areas' lessons are too basic: start them past the basics, or from them again.",
    setDailyMinutes: "A new daily time for every study day.",
    setDifficultyBias: "Lessons feel too easy or too hard.",
    setPracticeBias: "More practice or more explanation.",
    setTargetDate: "A new date for the exam or goal.",
    setWeekdayMinutes: "A different time or a day off on some weekdays only.",
    setWrittenCadence:
      "How often to practice the exam's written tests (an essay): every week, every other week or only near the exam.",
    skipActivities: "Leave a kind of language practice (words, listening, writing, speaking) out.",
    skipAreas: "Leave some areas out of the plan.",
  } satisfies Record<(typeof PLAN_EDIT_KINDS)[number] | "none", string>,
  toInput: toClassifierInput,
};
