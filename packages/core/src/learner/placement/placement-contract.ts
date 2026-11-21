import { type Goal } from "@zoonk/db";
import { CEFR_LEVELS, parseCefrScore } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { readCourseStart } from "../../goals/course-start-details";
import { tapAnswerSchema } from "../../sessions/contract";
import { answerTimeZoneSchema, itemAnswerInputSchema } from "../contract";
import { type OwnLevel } from "./placement-steps";

export const ownLevelSchema = z
  .enum(["none", "basic", "intermediate", "advanced"])
  .meta({
    description:
      "The learner's own level (nothing yet, basic, intermediate or advanced): where placement starts",
    id: "OwnLevel",
  }) satisfies z.ZodType<OwnLevel>;

export const placementLengthSchema = z
  .enum(["quick", "wholeCourse"])
  .meta({ id: "PlacementLength" });

export const placementAttemptViewSchema = z
  .object({
    estimatedMinutes: z.number().int().nonnegative(),
    id: uuidSchema(),
    length: placementLengthSchema,
    part: z.number().int().positive(),
    partComplete: z.boolean(),
  })
  .meta({ id: "PlacementAttempt" });

export const placementResultSchema = z
  .object({
    attemptId: uuidSchema(),
    finishedAt: z.iso.datetime(),
    lessonsSkipped: z.number().int().nonnegative(),
  })
  .meta({ id: "PlacementResult" });

const attemptFields = {
  attemptId: uuidSchema()
    .optional()
    .meta({ description: "The saved attempt. Omitted for onboarding clients without an attempt" }),
  part: z
    .number()
    .int()
    .positive()
    .optional()
    .meta({ description: "The part number in the saved attempt" }),
};

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

export const placementAnswerInputSchema = itemAnswerInputSchema
  .extend({
    ...attemptFields,
    answer: tapAnswerSchema,
    level: ownLevelSchema.optional(),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "PlacementAnswerInput" });

export type PlacementAnswerInput = z.infer<typeof placementAnswerInputSchema>;

export const placementCompletionInputSchema = z
  .object({
    ...attemptFields,
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

/** Request level overrides the stored goal level, including a measured language level. */
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

export function isPlacementSkipped(goal: { details: unknown }): boolean {
  const details = isJsonObject(goal.details) ? goal.details : {};

  return (
    details.level === "none" ||
    details.placementDeclined === true ||
    Boolean(readCourseStart(details)?.chapterId)
  );
}

export function getKnownSubjects(goal: Pick<Goal, "details">): string[] {
  const known = isJsonObject(goal.details) ? goal.details.knownSubjects : null;

  return Array.isArray(known)
    ? known.filter((item): item is string => typeof item === "string")
    : [];
}
