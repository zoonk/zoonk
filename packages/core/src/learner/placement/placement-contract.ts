import { type Goal } from "@zoonk/db";
import { CEFR_LEVELS, parseCefrScore } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { readCourseStart } from "../../goals/course-start-details";
import { tapAnswerSchema } from "../../sessions/tap-answer-contract";
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
    answered: z.int().nonnegative(),
    chapter: z.string().nullable(),
    estimatedMinutes: z.int().positive(),
    id: uuidSchema(),
    length: z.literal("quick"),
    part: z.literal(1),
    partComplete: z.literal(false),
    questions: z
      .int()
      .positive()
      .meta({ description: "Question ceiling fixed when the test starts" }),
  })
  .meta({ id: "PlacementAttempt" });

export const placementFinishSchema = z.object({
  answered: z.int().nonnegative(),
  end: z.enum(["stopped", "question_cap", "material_exhausted", "unknown_streak", "found"]),
  lessonsSkipped: z.int().nonnegative(),
  unknowns: z.int().nonnegative(),
});

export const coursePlacementOfferSchema = z.object({
  estimatedMinutes: z.int().positive(),
  questions: z.int().positive(),
});

export const placementResultSchema = z
  .object({
    attemptId: uuidSchema(),
    changeId: uuidSchema().nullable().optional(),
    chapter: z.string().nullable(),
    course: z
      .object({
        chapters: z.array(
          z.object({
            done: z.int().nonnegative(),
            lessons: z.int().nonnegative(),
            skipped: z.int().nonnegative(),
            start: z.boolean(),
          }),
        ),
        lessons: z.int().nonnegative(),
      })
      .nullable(),
    finish: placementFinishSchema.optional(),
    finishedAt: z.iso.datetime(),
    heldUntilTomorrow: z
      .literal(true)
      .optional()
      .meta({
        description:
          "Fresh answers met the skip rule on a topic whose skip was undone on the same local day",
      }),
    lessonsSkipped: z.number().int().nonnegative(),
    nextLesson: z
      .object({
        chapter: z.string().nullable(),
        estimatedMinutes: z.int().positive(),
        id: uuidSchema(),
        title: z.string(),
      })
      .nullable(),
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
      "What to do next. `preparing`: the goal's skill map isn't ready, so there's nothing to place yet; ask again soon. `asking`: `next` is the question to ask. `waitingForQuestions`: the questions placement needs next (`needsItems`) are still being written; ask again soon, or finish placement with what's known. `done`: nothing more to ask now, because the test or sitting has ended or is paused. `unavailable`: the next question is unavailable and no writer is known to be preparing it. `failed`: the plan build stopped before it had skills, or preparation stopped before a course test had enough questions. Starting the sitting again retries preparation.",
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
    answered: z.int().nonnegative().optional(),
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
