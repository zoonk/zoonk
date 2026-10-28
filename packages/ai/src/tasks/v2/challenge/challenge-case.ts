import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import { formatLocalContext } from "../../_utils/language-context";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import systemPrompt from "./challenge-case.prompt.md";

/**
 * Sol scored highest on the challenge-case eval (27 Sep 2026). A challenge is written once per
 * chapter and shared, so quality outweighs cost.
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

/** A work case feels like a real job; a "What if" is a light scenario for overview courses. */
type ChallengeCaseVariant = "whatIf" | "work";

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the case and its people come before the decisions that use them. */
const messageSchema = z.object({ from: z.string(), text: z.string() });

const panelSchema = z.object({
  title: z.string().nullable(),
  metrics: z.array(z.object({ label: z.string(), value: z.string(), note: z.string().nullable() })),
  note: z.string().nullable(),
});

const choiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  quality: z.enum(["strong", "fair", "weak"]),
  replies: z.array(messageSchema),
  effects: z.array(z.object({ meter: z.string(), change: z.number().int() })),
  timeJump: z.object({ label: z.string(), panel: panelSchema.nullable() }).nullable(),
  notes: z.array(
    z.object({
      skill: z.string(),
      kind: z.enum(["good", "improve"]),
      text: z.string(),
      example: z.string().nullable(),
    }),
  ),
  next: z.string(),
});

const schema = z.object({
  title: z.string(),
  setting: z.string(),
  mission: z.string(),
  deadline: z.string().nullable(),
  panels: z.array(panelSchema),
  team: z.array(
    z.object({ id: z.string(), role: z.string(), expertise: z.string(), ai: z.boolean() }),
  ),
  meters: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      start: z.number().int(),
      goodWhen: z.enum(["high", "low"]),
    }),
  ),
  skills: z.array(z.object({ id: z.string(), name: z.string(), practice: z.string() })),
  startNodeId: z.string(),
  nodes: z.array(
    z.object({
      id: z.string(),
      messages: z.array(messageSchema),
      prompt: z.string(),
      choices: z.array(choiceSchema),
    }),
  ),
  endings: z.array(z.object({ id: z.string(), outcome: z.string() })),
  summary: z.array(z.string()),
});
/* oxlint-enable eslint/sort-keys */

export type WrittenChallengeCase = z.infer<typeof schema>;

type ChallengeSkillInput = { name: string; description?: string | null };

export type ChallengeCaseParams = {
  language: string;
  level: CourseLevel;
  variant: ChallengeCaseVariant;
  courseTitle: string;
  chapterTitle: string;
  chapterDescription?: string | null;
  skills: ChallengeSkillInput[];
  /** Null for the general case. */
  field?: string | null;
  /** What code found wrong with an earlier attempt. */
  problems?: string[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  serviceTier?: ServiceTier;
  analytics?: AiGenerationContext;
};

function formatList(items: readonly string[]): string {
  return items.length === 0 ? "none" : items.map((item) => `\n- ${item}`).join("");
}

function formatSkill(skill: ChallengeSkillInput): string {
  return skill.description ? `${skill.name}: ${skill.description}` : skill.name;
}

function buildUserPrompt(params: ChallengeCaseParams): string {
  return `
    LANGUAGE: ${getPromptLanguageName({ language: params.language })}
${formatLocalContext(params.language)}
    LEVEL: ${params.level}
    VARIANT: ${params.variant}
    FIELD: ${params.field ?? "none"}
    COURSE_TITLE: ${params.courseTitle}
    CHAPTER_TITLE: ${params.chapterTitle}
    CHAPTER_DESCRIPTION: ${params.chapterDescription ?? "none"}
    SKILLS: ${formatList(params.skills.map((skill) => formatSkill(skill)))}
    PROBLEMS_TO_AVOID: ${formatList(params.problems ?? [])}
  `;
}

/** Code checks the decision graph afterwards; `problems` sends failures back for one more try. */
export async function generateChallengeCase(params: ChallengeCaseParams) {
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
    libraryInput: true,
    systemPrompt,
    task: "challenge-case",
  });

  return { data: result.output, provenance, systemPrompt, usage: result.usage, userPrompt };
}
