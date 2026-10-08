import { type Goal } from "@zoonk/db";
import { CEFR_LEVELS, parseCefrScore } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { answerTimeZoneSchema, choiceAnswerSchema, itemAnswerInputSchema } from "../contract";
import { type OwnLevel } from "./placement-steps";

export const ownLevelSchema = z
  .enum(["none", "basic", "intermediate", "advanced"])
  .meta({
    description:
      "The learner's own level (nothing yet, basic, intermediate or advanced): where placement starts",
    id: "OwnLevel",
  }) satisfies z.ZodType<OwnLevel>;

export const placementQuerySchema = z
  .object({ level: ownLevelSchema.optional(), timeZone: answerTimeZoneSchema })
  .strict();

export const placementStatusSchema = z
  .enum(["preparing", "asking", "waitingForQuestions", "done", "unavailable", "failed"])
  .meta({
    description:
      "What to do next. `preparing`: the goal's skill map isn't ready, so there's nothing to place yet; ask again soon. `asking`: `next` is the question to ask. `waitingForQuestions`: the questions placement needs next (`needsItems`) are still being written; ask again soon, or finish placement with what's known. `done`: nothing more to ask now, because every start is confident (`complete`), today's few minutes are used (`dayBudgetUsed`), or no question exists for what's left, which lessons and reviews settle instead. `unavailable`: no placement question could be written and none was answered; finish placement and go on without it (the first week's sessions and lessons place the learner). `failed`: the run building the goal's plan gave up before it had skills; start it again with POST /goals/{goalId}/generations.",
    id: "PlacementStatus",
  });

export type PlacementStatus = z.infer<typeof placementStatusSchema>;

/** Typed answers are a sentence or two, graded one key point at a time. */
const MAX_TYPED_PLACEMENT_ANSWER = 1000;

/** A choice (or "I don't know yet"), or the text of a typed answer. */
const placementAnswerSchema = z
  .union([
    choiceAnswerSchema,
    z
      .object({ text: z.string().trim().min(1).max(MAX_TYPED_PLACEMENT_ANSWER) })
      .strict()
      .meta({ description: "The learner's own words, for a `typed` question" }),
  ])
  .meta({ id: "PlacementAnswer" });

export const placementAnswerInputSchema = itemAnswerInputSchema
  .extend({
    answer: placementAnswerSchema,
    level: ownLevelSchema.optional(),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "PlacementAnswerInput" });

export type PlacementAnswerInput = z.infer<typeof placementAnswerInputSchema>;

export const placementCompletionInputSchema = z
  .object({
    fromScratch: z
      .boolean()
      .optional()
      .meta({
        description: '"I\'d rather start from scratch": start every phase at its beginning',
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "PlacementCompletionInput" });

export type PlacementCompletionInput = z.infer<typeof placementCompletionInputSchema>;

/**
 * A language level test's result on the own-level scale, by the Library band it covers: B1 and up
 * has the beginner band (A1–A2) behind it, C1 and up the intermediate one too.
 */
const CEFR_OWN_LEVELS: readonly { from: number; level: OwnLevel }[] = [
  { from: CEFR_LEVELS.indexOf("C1"), level: "advanced" },
  { from: CEFR_LEVELS.indexOf("B1"), level: "intermediate" },
  { from: CEFR_LEVELS.indexOf("A2"), level: "basic" },
  { from: 0, level: "none" },
];

function fromCefrLevel(label: unknown): OwnLevel | null {
  const score = parseCefrScore(label);

  return score === null
    ? null
    : (CEFR_OWN_LEVELS.find((step) => score >= step.from)?.level ?? null);
}

/**
 * The level the learner gave: this request's, then the one onboarding stored on the goal, which a
 * language goal's level test replaces with its CEFR level ("B1+").
 */
export function getOwnLevel({
  goal,
  level,
}: {
  goal: Pick<Goal, "details">;
  level?: OwnLevel | null;
}): OwnLevel | null {
  if (level) {
    return level;
  }

  const stored = isJsonObject(goal.details) ? goal.details.level : null;
  const parsed = ownLevelSchema.safeParse(stored);

  return parsed.success ? parsed.data : fromCefrLevel(stored);
}

/**
 * The subjects of an exam the learner said they already know well in onboarding (the notice's
 * names): their basics start as known.
 */
export function getKnownSubjects(goal: Pick<Goal, "details">): string[] {
  const known = isJsonObject(goal.details) ? goal.details.knownSubjects : null;

  return Array.isArray(known)
    ? known.filter((item): item is string => typeof item === "string")
    : [];
}
