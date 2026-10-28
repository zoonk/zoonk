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

/** Flash Lite got the routine cases right on the plan-edit-intent eval (27 Sep and 7 Oct 2026). */
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
  language: string;
  memory: readonly string[];
  today: string;
  /** Sunday first. */
  weekdayMinutes: number[];
};

export type PlanRoutineFitParams = PlanRoutineFitInput & {
  analytics?: AiGenerationContext;
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

type RoutineOperation =
  | Extract<DateOperation, { kind: "addLightWeek" }>
  | Extract<TimeOperation, { kind: "setWeekdayMinutes" }>;

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

/** Checked the same way as a plan edit's; the reason goes only with changes. */
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

/** Nothing comes back when no fact clearly changes a day. */
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
