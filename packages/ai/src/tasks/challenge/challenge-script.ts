import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { buildProviderOptions } from "../../provider-options";
import { formatLocalContext } from "../_utils/language-context";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { CHALLENGE_MODELS } from "./challenge-models";
import { type ChallengePlan, getChallengeSystemPrompt } from "./challenge-plan";
import { describePlanForScript } from "./challenge-plan-paths";
import { type ChallengeCaseParams, challengePanelSchema } from "./challenge-schema";
import promptTemplate from "./challenge-script.prompt.md";

function idEnum(ids: readonly string[]) {
  const [first, ...rest] = [...new Set(ids)];
  return first === undefined ? null : z.enum([first, ...rest]);
}

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: what's said before a pick comes before the choices and what follows them. */
export function buildChallengeScriptSchema(plan: ChallengePlan) {
  const from = idEnum(plan.team.map((slot) => slot.id)) ?? z.string();
  const meter = idEnum(plan.meters.map((item) => item.id)) ?? z.string();
  const skill = idEnum(plan.skills.map((item) => item.id)) ?? z.string();
  const message = z.object({ from, text: z.string() });

  const choice = z.object({
    id:
      idEnum(plan.decisions.flatMap((decision) => decision.choices.map((item) => item.id))) ??
      z.string(),
    text: z.string(),
    replies: z.array(message),
    effects: z.array(z.object({ meter, change: z.number().int() })),
    panel: challengePanelSchema.nullable(),
    notes: z.array(
      z.object({
        skill,
        kind: z.enum(["good", "improve"]),
        text: z.string(),
        example: z.string().nullable(),
      }),
    ),
  });

  return z.object({
    decisions: z.array(
      z.object({
        id: idEnum(plan.decisions.map((decision) => decision.id)) ?? z.string(),
        messages: z.array(message),
        prompt: z.string(),
        choices: z.array(choice),
      }),
    ),
    endings: z.array(
      z.object({
        id: idEnum(plan.endings.map((ending) => ending.id)) ?? z.string(),
        outcome: z.string(),
      }),
    ),
    summary: z.array(z.string()),
  });
}
/* oxlint-enable eslint/sort-keys */

export type ChallengeScript = z.infer<ReturnType<typeof buildChallengeScriptSchema>>;

export type ChallengeScriptParams = Pick<
  ChallengeCaseParams,
  | "analytics"
  | "chapterTitle"
  | "courseTitle"
  | "country"
  | "field"
  | "language"
  | "level"
  | "model"
  | "reasoning"
  | "serviceTier"
  | "speed"
  | "variant"
  | "useFallback"
> & { plan: ChallengePlan };

function buildUserPrompt({ plan, ...params }: ChallengeScriptParams): string {
  return [
    `LANGUAGE: ${getPromptLanguageName({ language: params.language })}`,
    formatLocalContext({ country: params.country, language: params.language }).trim(),
    `LEVEL: ${params.level}`,
    `COURSE_TITLE: ${params.courseTitle}`,
    `CHAPTER_TITLE: ${params.chapterTitle}`,
    describePlanForScript(plan),
  ].join("\n");
}

export async function generateChallengeScript(params: ChallengeScriptParams) {
  const { analytics, model = CHALLENGE_MODELS.model, plan, reasoning, serviceTier, speed } = params;

  const systemPrompt = getChallengeSystemPrompt({ ...params, template: promptTemplate });
  const userPrompt = buildUserPrompt(params);

  const providerOptions = buildProviderOptions({
    fallbackModels: CHALLENGE_MODELS.fallbackModels,
    model,
    serviceTier,
    speed,
    useFallback: params.useFallback ?? true,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema: buildChallengeScriptSchema(plan) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: analytics?.contentScope !== "personal",
    systemPrompt,
    task: "challenge-script",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
