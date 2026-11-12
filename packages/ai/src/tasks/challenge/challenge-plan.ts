import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { buildProviderOptions } from "../../provider-options";
import { NEUTRAL_ADDRESS_PROMPT } from "../_utils/address-form";
import { formatLocalContext } from "../_utils/language-context";
import { getPromptLanguageName } from "../_utils/prompt-language";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { type ChallengeCaseParams, challengeCaseSchema } from "./challenge-case";
import { CHALLENGE_MODELS } from "./challenge-models";
import promptTemplate from "./challenge-plan.prompt.md";

const { meters, mission, panels, setting, skills, team, title } = challengeCaseSchema.shape;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the facts come before the panels and decisions that use them. */
const planChoiceSchema = z.object({
  id: z.string(),
  move: z.string(),
  quality: z.enum(["strong", "fair", "weak"]),
  buys: z.string(),
  costs: z.string(),
  establishes: z.array(z.string()),
  timePasses: z.string().nullable(),
  next: z.string(),
});

const jobPlanSchema = z.object({
  title,
  setting,
  mission,
  deadline: z.string(),
  team,
  skills,
  meters,
  facts: z.array(
    z.object({
      id: z.string(),
      fact: z.string(),
      derivation: z.string(),
      known: z.enum(["start", "later"]),
    }),
  ),
  panels,
  startDecisionId: z.string(),
  decisions: z.array(
    z.object({
      id: z.string(),
      situation: z.string(),
      pull: z.string(),
      insight: z.string(),
      skills: z.array(z.string()),
      choices: z.array(planChoiceSchema),
    }),
  ),
  endings: z.array(z.object({ id: z.string(), result: z.string(), restsOn: z.array(z.string()) })),
});
/* oxlint-enable eslint/sort-keys */

const whatIfPlanSchema = jobPlanSchema.omit({ deadline: true });

export function getChallengePlanSchema(variant: ChallengeCaseParams["variant"]) {
  return variant === "work" ? jobPlanSchema : whatIfPlanSchema;
}

export type ChallengePlan = z.infer<typeof whatIfPlanSchema> & { deadline?: string };

export type ChallengePlanParams = ChallengeCaseParams;

function formatList(items: readonly string[]): string {
  return items.map((item) => `\n- ${item}`).join("");
}

function buildUserPrompt(params: ChallengePlanParams): string {
  const lines = [
    `LANGUAGE: ${getPromptLanguageName({ language: params.language })}`,
    formatLocalContext(params.language).trim(),
    `LEVEL: ${params.level}`,
    params.field && `FIELD: ${params.field}`,
    `COURSE_TITLE: ${params.courseTitle}`,
    `CHAPTER_TITLE: ${params.chapterTitle}`,
    params.chapterDescription && `CHAPTER_DESCRIPTION: ${params.chapterDescription}`,
    `SKILLS: ${formatList(
      params.skills.map((skill) =>
        skill.description ? `${skill.name}: ${skill.description}` : skill.name,
      ),
    )}`,
    params.problems?.length && `PROBLEMS_TO_AVOID: ${formatList(params.problems)}`,
  ];

  return lines.filter(Boolean).join("\n");
}

export function getChallengeSystemPrompt({
  field,
  template,
  variant,
}: Pick<ChallengeCaseParams, "field" | "variant"> & { template: string }): string {
  const job = variant === "work";

  const prompt = selectPromptVariants({
    template,
    variants: { field: job && Boolean(field), job, whatIf: !job, work: job && !field },
  });

  return `${prompt}\n${NEUTRAL_ADDRESS_PROMPT}`;
}

export async function generateChallengePlan(params: ChallengePlanParams) {
  const { analytics, model = CHALLENGE_MODELS.model, reasoning, serviceTier, speed } = params;

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
        output: Output.object<ChallengePlan>({ schema: getChallengePlanSchema(params.variant) }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: analytics?.contentScope !== "personal",
    systemPrompt,
    task: "challenge-plan",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
