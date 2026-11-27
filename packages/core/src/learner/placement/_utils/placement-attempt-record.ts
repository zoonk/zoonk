import { isJsonObject } from "@zoonk/utils/json";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import {
  PART_QUESTIONS,
  QUESTIONS_PER_TOPIC,
  TOPICS_PER_PART,
  getCourseMinutes,
} from "../placement-budget";
import {
  type coursePlacementOfferSchema,
  type placementAttemptViewSchema,
  placementFinishSchema,
  placementLengthSchema,
  placementResultSchema,
} from "../placement-contract";

export type PlacementAttemptView = z.infer<typeof placementAttemptViewSchema>;
export type PlacementLength = z.infer<typeof placementLengthSchema>;
export type PlacementResult = z.infer<typeof placementResultSchema>;

const partReceiptSchema = z.object({
  finish: placementFinishSchema.optional(),
  heldUntilTomorrow: placementResultSchema.shape.heldUntilTomorrow,
  knownSkillIds: z.array(uuidSchema()),
  lessonsSkipped: z.number().int().nonnegative(),
  part: z.number().int().positive(),
  testedOutPlanItemIds: z.array(uuidSchema()),
});

const attemptSchema = z.object({
  id: uuidSchema(),
  length: placementLengthSchema,
  lessonsSkipped: z.number().int().nonnegative(),
  part: z.int().positive(),
  partComplete: z.boolean(),
  partPreparationFailed: z.boolean().optional(),
  partPrepared: z.boolean().optional(),
  partRequestedAt: z.iso.datetime().nullable().optional(),
  partSkillIds: z.array(uuidSchema()).optional(),
  partStartedAt: z.iso.datetime(),
  parts: z.array(z.array(uuidSchema())).optional(),
  partsAtOpen: z.int().positive().optional(),
  paused: z.boolean().optional(),
  skillIds: z.array(uuidSchema()),
});

const recordSchema = z.object({
  attempt: attemptSchema.nullable(),
  finishedParts: z.array(partReceiptSchema).default([]),
  result: placementResultSchema.nullable(),
});

export type PlacementAttempt = z.infer<typeof attemptSchema>;
export type PlacementRecord = z.infer<typeof recordSchema>;

export function readPlacementAttempt(goal: { details: unknown }): PlacementRecord {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const record = recordSchema.safeParse(details.placementTest);
  return record.data ?? { attempt: null, finishedParts: [], result: null };
}

export function splitPlacementParts(skillIds: readonly string[]): string[][] {
  return Array.from({ length: Math.ceil(skillIds.length / TOPICS_PER_PART) }, (_, index) =>
    skillIds.slice(index * TOPICS_PER_PART, (index + 1) * TOPICS_PER_PART),
  );
}

export function getAttemptParts(attempt: PlacementAttempt): string[][] {
  if (attempt.parts) {
    return attempt.parts;
  }

  // An already-open sitting retains its scope and uses the new twelve-question cap.
  const current = attempt.partSkillIds ?? attempt.skillIds.slice(0, TOPICS_PER_PART);
  const later = attempt.skillIds.filter((id) => !current.includes(id));

  return [
    ...Array.from({ length: attempt.part - 1 }, () => []),
    current,
    ...splitPlacementParts(later),
  ];
}

export function settlePlacementPart({
  attempt,
  lessonsSkipped,
  progress,
}: {
  attempt: PlacementAttempt;
  lessonsSkipped: number;
  progress: { complete: boolean; partsLeft: number; retainedParts: string[][] };
}): PlacementAttempt | null {
  if (progress.partsLeft === 0) {
    return null;
  }

  return {
    ...attempt,
    lessonsSkipped,
    partComplete: progress.complete,
    // Attempts without stored parts still use timestamps for the current part's answers.
    ...(attempt.parts && { parts: progress.retainedParts }),
    paused: !progress.complete,
  };
}

export function getCourseOffer(topics: number): z.infer<typeof coursePlacementOfferSchema> | null {
  if (topics === 0) {
    return null;
  }

  const questions = Math.min(PART_QUESTIONS, topics * QUESTIONS_PER_TOPIC);
  const parts = Math.ceil(topics / TOPICS_PER_PART);

  return {
    estimatedMinutes: getCourseMinutes(questions),
    questions,
    wholeCourse:
      parts > 1
        ? { estimatedMinutes: getCourseMinutes(topics * QUESTIONS_PER_TOPIC), parts }
        : null,
  };
}

/** A topic is still ahead while one of its lessons is to do, or before it has any. */
function isTopicAhead(lessons: readonly { status: string }[] | undefined): boolean {
  return lessons?.some((lesson) => lesson.status === "todo") ?? true;
}

export function getTopicsAhead(plan: GoalPlan) {
  const itemsBySkill = Map.groupBy(
    plan.items.flatMap((item) =>
      item.skillIds.map((skillId) => ({ skillId, status: item.status })),
    ),
    (item) => item.skillId,
  );

  return plan.skills.filter((skill) => !skill.removed && isTopicAhead(itemsBySkill.get(skill.id)));
}
