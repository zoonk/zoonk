import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { decodeHtmlEntities } from "../../_utils/html-entities";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import {
  type DateOperation,
  type TimeOperation,
  toDateOperation,
  toTimeOperation,
} from "./plan-edit-calendar";
import { formatMemory, formatToday, formatWeek } from "./plan-prompt-format";
import systemPrompt from "./plan-routine-fit.prompt.md";

/**
 * The same model as plan edits, which fitted new plans to the routine before this task had its own
 * prompt: Gemini 3.5 Flash Lite got the routine cases right (27 Sep and 7 Oct 2026) in the
 * plan-edit-intent eval. It runs in the background after a plan is built.
 */
const defaultModel = "google/gemini-3.5-flash-lite";
const fallbackModels = ["anthropic/claude-haiku-5.5", "openai/gpt-6-luna"] as const;

/** Flat, with nullable fields, so every provider's structured output reads it the same way. */
const changeSchema = z.object({
  date: z.string().nullable(),
  kind: z.enum(["setWeekdayMinutes", "addLightWeek"]),
  minutes: z.number().nullable(),
  weekdays: z.array(z.number()).nullable(),
});

const schema = z.object({ changes: z.array(changeSchema), reason: z.string() });

export type PlanRoutineFitInput = {
  dailyMinutes: number;
  /** The learner's language, for the reason. */
  language: string;
  /** What the learner told the app about their goals and routine ("Works late on Tuesdays"). */
  memory: readonly string[];
  /** The learner-local date, YYYY-MM-DD. */
  today: string;
  /** Minutes per weekday, Sunday first. */
  weekdayMinutes: number[];
};

export type PlanRoutineFitParams = PlanRoutineFitInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

/** What fitting a new plan to the routine may change: days off, lighter days and light weeks. */
type RoutineOperation =
  | Extract<DateOperation, { kind: "addLightWeek" }>
  | Extract<TimeOperation, { kind: "setWeekdayMinutes" }>;

/** The changes that fit a new plan to the routine, with the sentence saying why; none fits. */
export type PlanRoutineFit = { operations: RoutineOperation[]; reason: string };

function toRoutineOperation({
  change,
  today,
}: {
  change: z.infer<typeof changeSchema>;
  today: string;
}): RoutineOperation | null {
  const operation =
    change.kind === "addLightWeek" ? toDateOperation({ change, today }) : toTimeOperation(change);

  return operation?.kind === "addLightWeek" || operation?.kind === "setWeekdayMinutes"
    ? operation
    : null;
}

/**
 * The changes the planner can apply as written, checked the same way as a plan edit's: real
 * weekdays, minutes in range and light weeks from today. The reason goes only with changes.
 */
function normalizeRoutineFit({
  raw,
  today,
}: {
  raw: z.infer<typeof schema>;
  today: string;
}): PlanRoutineFit {
  const operations = raw.changes.flatMap((change) => toRoutineOperation({ change, today }) ?? []);

  return { operations, reason: operations.length > 0 ? decodeHtmlEntities(raw.reason).trim() : "" };
}

function buildUserPrompt(input: PlanRoutineFitInput): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: input.language })}
    TODAY: ${formatToday(input.today)}
    DAILY_MINUTES: ${input.dailyMinutes}
    WEEK: ${formatWeek(input.weekdayMinutes)}

${formatUntrustedInput({ MEMORY: formatMemory(input.memory) })}
  `;
}

/**
 * Fits a new plan's week to what memory holds about the learner's routine ("Sundays are for
 * family"): only days off, lighter weekdays and dated light weeks, with one sentence saying what
 * changes and why. Changes the planner can't apply (unknown weekdays, past weeks) are dropped, and
 * nothing comes back when no fact clearly changes a day.
 */
export async function fitPlanToRoutineFacts(
  params: PlanRoutineFitParams,
): Promise<{
  data: PlanRoutineFit;
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
    task: "plan-routine-fit",
  });

  const data = normalizeRoutineFit({ raw: result.output, today: params.today });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
