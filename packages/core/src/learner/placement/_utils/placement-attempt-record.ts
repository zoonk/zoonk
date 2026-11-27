import { isJsonObject } from "@zoonk/utils/json";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { type GoalPlan } from "../../_utils/goal-skill-graph";
import { COURSE_QUESTION_LIMIT } from "../course-search";
import { getCourseMinutes } from "../placement-budget";
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

const frozenTopicSchema = z.object({
  askable: z.boolean(),
  chapter: z.string().nullable(),
  id: uuidSchema(),
  itemIds: z.array(uuidSchema()).max(2),
  lessons: z.int().nonnegative(),
  sectionTitle: z.string().nullable(),
});

const attemptSchema = z.object({
  id: uuidSchema(),
  length: placementLengthSchema,
  lessonsSkipped: z.number().int().nonnegative(),
  part: z.int().positive(),
  partComplete: z.boolean(),
  partStartedAt: z.iso.datetime(),
  paused: z.boolean().optional(),
  search: z
    .object({
      failed: z.boolean().optional(),
      position: z.number().min(0).max(1),
      questions: z.int().min(1).max(COURSE_QUESTION_LIMIT),
      topics: z.array(frozenTopicSchema).nullable(),
    })
    .optional(),
  skillIds: z.array(uuidSchema()),
});

const recordSchema = z.object({
  attempt: attemptSchema.nullable(),
  finishedParts: z.array(partReceiptSchema).default([]),
  result: placementResultSchema
    .extend({
      chapter: placementResultSchema.shape.chapter.default(null),
      course: placementResultSchema.shape.course.default(null),
      nextLesson: z
        .object({
          chapter: z.string().nullable().optional(),
          estimatedMinutes: z.int().positive().optional(),
          id: uuidSchema(),
          title: z.string(),
        })
        .nullable()
        .optional(),
      startedPastSkillIds: z.array(uuidSchema()).optional(),
    })
    .nullable(),
});

export type PlacementAttempt = z.infer<typeof attemptSchema>;
export type PlacementRecord = z.infer<typeof recordSchema>;

export function readPlacementAttempt(goal: { details: unknown }): PlacementRecord {
  const details = isJsonObject(goal.details) ? goal.details : {};
  const record = recordSchema.safeParse(details.placementTest);
  return record.data ?? { attempt: null, finishedParts: [], result: null };
}

export function getCourseOffer(topics: number): z.infer<typeof coursePlacementOfferSchema> | null {
  if (topics < 2) {
    return null;
  }

  const questions = Math.min(COURSE_QUESTION_LIMIT, topics * 2);
  return { estimatedMinutes: getCourseMinutes(questions), questions };
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

export function matchesAttempt({
  attempt,
  attemptId,
  part,
}: {
  attempt: PlacementAttempt | null;
  attemptId?: string;
  part?: number;
}): boolean {
  if (!attemptId) {
    // Released Android starts onboarding's quick course test without a sitting.
    return attempt === null;
  }

  return attempt?.id === attemptId && !attempt.partComplete && (part ?? 1) === attempt.part;
}
