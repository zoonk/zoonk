import { isJsonObject } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { LOW_GUESS_ANSWERS_TO_SKIP } from "../../_utils/placement-guess-rate";
import { DAY_PLACEMENT_MINUTES } from "../placement-budget";
import {
  placementAttemptViewSchema,
  type placementLengthSchema,
  placementResultSchema,
} from "../placement-contract";

export type PlacementAttemptView = z.infer<typeof placementAttemptViewSchema>;
export type PlacementLength = z.infer<typeof placementLengthSchema>;
export type PlacementResult = z.infer<typeof placementResultSchema>;

const partReceiptSchema = z.object({
  heldUntilTomorrow: placementResultSchema.shape.heldUntilTomorrow,
  knownSkillIds: z.array(uuidSchema()),
  lessonsSkipped: z.number().int().nonnegative(),
  part: z.number().int().positive(),
  testedOutPlanItemIds: z.array(uuidSchema()),
});

const attemptSchema = placementAttemptViewSchema.extend({
  lessonsSkipped: z.number().int().nonnegative(),
  partPrepared: z.boolean().optional(),
  partSkillIds: z.array(uuidSchema()).optional(),
  partStartedAt: z.iso.datetime(),
  remainingSkillIds: z.array(uuidSchema()).optional(),
  skillIds: z.array(uuidSchema()),
});

const recordSchema = z.object({
  assessmentId: uuidSchema().optional(),
  attempt: attemptSchema.nullable(),
  finishedParts: z.array(partReceiptSchema).default([]),
  quickFollowUpSkillIds: z.array(uuidSchema()).optional(),
  result: placementResultSchema.nullable(),
});

export type PlacementAttempt = z.infer<typeof attemptSchema>;
export type PlacementRecord = z.infer<typeof recordSchema>;

export function readPlacementAttempt(goal: { details: unknown }): PlacementRecord {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const record = recordSchema.safeParse(details.placementTest);
  return record.data ?? { attempt: null, finishedParts: [], result: null };
}

export function readReadyAssessmentId(details: unknown): string | null {
  const levelTest = isJsonObject(details) ? details.levelTest : null;
  const attempt = isJsonObject(levelTest) ? levelTest.attempt : null;

  if (
    !isJsonObject(attempt) ||
    !isJsonObject(attempt.result) ||
    attempt.result.wholeCourseReady !== true ||
    typeof attempt.attemptId !== "string" ||
    !isUuid(attempt.attemptId)
  ) {
    return null;
  }

  return attempt.attemptId;
}

export function readPendingTopicWalkAssessmentId(
  goal: { details: unknown },
  record = readPlacementAttempt(goal),
): string | null {
  const assessmentId = readReadyAssessmentId(goal.details);
  return record.assessmentId === assessmentId ? null : assessmentId;
}

export function placementAttemptView(attempt: PlacementAttempt): PlacementAttemptView {
  const { estimatedMinutes, id, length, part, partComplete } = attempt;
  return { estimatedMinutes, id, length, part, partComplete };
}

const MINUTE_MS = 60_000;
const PART_MINUTES = 10;

const QUESTIONS_PER_TOPIC = 1 + LOW_GUESS_ANSWERS_TO_SKIP;
export const TOPICS_PER_PART = PART_MINUTES;

export function getWholeCourseMinutes({
  questions,
  paceMs = MINUTE_MS / QUESTIONS_PER_TOPIC,
}: {
  questions: number;
  paceMs?: number;
}) {
  return Math.ceil((questions * paceMs) / MINUTE_MS);
}

export function getPlacementEstimate({
  length,
  topics,
}: {
  length: PlacementLength;
  topics: number;
}) {
  return length === "quick"
    ? DAY_PLACEMENT_MINUTES
    : getWholeCourseMinutes({ questions: topics * QUESTIONS_PER_TOPIC });
}

export function getTopicsAhead(plan: GoalPlan) {
  const itemsBySkill = Map.groupBy(
    plan.items.flatMap((item) =>
      item.skillIds.map((skillId) => ({ skillId, status: item.status })),
    ),
    (item) => item.skillId,
  );

  return plan.skills.filter(
    (skill) =>
      !skill.removed &&
      (itemsBySkill.get(skill.id)?.some((item) => item.status === "todo") ?? true),
  );
}
