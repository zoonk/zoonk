import { z } from "zod";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type Reasoning, type ServedSpeed, type ServiceTier } from "../../provider-options";
import { type CourseLevel } from "../curriculum/_utils/course-levels";

/** A work case feels like a real job; a "What if" is a light scenario for overview courses. */
type ChallengeCaseVariant = "whatIf" | "work";

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the case and its people come before the decisions that use them. */
const messageSchema = z.object({ from: z.string(), text: z.string() });

export const challengePanelSchema = z.object({
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
  timeJump: z.object({ label: z.string(), panel: challengePanelSchema.nullable() }).nullable(),
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

export const challengeCaseSchema = z.object({
  title: z.string(),
  setting: z.string(),
  mission: z.string(),
  deadline: z.string().nullable(),
  panels: z.array(challengePanelSchema),
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

export type WrittenChallengeCase = z.infer<typeof challengeCaseSchema>;

type ChallengeSkillInput = { name: string; description?: string | null };

export type ChallengeCaseParams = {
  language: string;
  country: string | null;
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
  speed?: ServedSpeed;
  analytics?: AiGenerationContext;
};
