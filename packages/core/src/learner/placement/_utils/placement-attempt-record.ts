import { isJsonObject } from "@zoonk/utils/json";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
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
  finishedAt: z.iso.datetime(),
  knownSkillIds: z.array(uuidSchema()),
  lessonsSkipped: z.number().int().nonnegative(),
  part: z.number().int().positive(),
  testedOutPlanItemIds: z.array(uuidSchema()),
});

const attemptSchema = placementAttemptViewSchema.extend({
  lessonsSkipped: z.number().int().nonnegative(),
  partStartedAt: z.iso.datetime(),
  skillIds: z.array(uuidSchema()),
  topicCount: z.number().int().nonnegative(),
});

const recordSchema = z.object({
  assessmentId: uuidSchema().optional(),
  attempt: attemptSchema.nullable(),
  lastPart: partReceiptSchema.extend({ attemptId: uuidSchema() }).nullable(),
  quickFollowUpSkillIds: z.array(uuidSchema()).optional(),
  result: placementResultSchema.nullable(),
});

export type PlacementAttempt = z.infer<typeof attemptSchema>;
export type PlacementRecord = z.infer<typeof recordSchema>;

export function readPlacementAttempt(goal: { details: unknown }): PlacementRecord {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const record = recordSchema.safeParse(details.placementTest);
  return record.data ?? { attempt: null, lastPart: null, result: null };
}

export function placementAttemptView(attempt: PlacementAttempt): PlacementAttemptView {
  const { estimatedMinutes, id, length, part, partComplete } = attempt;
  return { estimatedMinutes, id, length, part, partComplete };
}

const MINUTES_PER_AHEAD_TOPIC = 1;

export function getPlacementEstimate({
  length,
  topics,
}: {
  length: PlacementLength;
  topics: number;
}) {
  return length === "quick" ? DAY_PLACEMENT_MINUTES : topics * MINUTES_PER_AHEAD_TOPIC;
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
