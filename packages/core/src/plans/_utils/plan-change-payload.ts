import { z } from "zod";
import { anyPlanOperationSchema } from "../plan-contract";
import { type PlanEffect } from "../planner/plan-effect";
import { planStateSchema } from "../planner/plan-state";

/**
 * What happened to a plan. `edited`: the learner or a proposal changed how it's shaped (undoable).
 * `testedOut`: placement or a test-out skipped lessons (undoable). `missedDays`: missed days moved
 * the rest forward. `estimateUpdated`: the pace estimate got more precise. `resumed`: a paused goal
 * started again from today.
 */
const PLAN_CHANGE_KINDS = [
  "edited",
  "estimateUpdated",
  "missedDays",
  "resumed",
  "testedOut",
] as const;

export type PlanChangeKind = (typeof PLAN_CHANGE_KINDS)[number];

/**
 * Who asked for a change: "learner" in the app, "planEdit" (the AI reading their words), "system"
 * for re-planning, or the part of core that proposed it, such as "memory" or "preparation".
 */
export type PlanChangeSource = string;

export const planEffectSchema = z.object({
  endDateAfter: z.string().nullable(),
  endDateBefore: z.string().nullable(),
  lessonsAdded: z.int(),
  lessonsRemoved: z.int(),
});

const planChangePayloadSchema = z.object({
  /** The state before an applied edit, which its undo restores. */
  before: planStateSchema.nullable().default(null),
  /** Study days missed, for `missedDays`. */
  days: z.int().nullable().default(null),
  effect: planEffectSchema.nullable().default(null),
  /** Lessons a test-out skipped, a skill not outlined yet counting its estimated lessons. */
  lessons: z.int().nullable().default(null),
  operations: z.array(anyPlanOperationSchema).default([]),
  /** Items a test-out skipped, which its undo brings back. */
  planItemIds: z.array(z.string()).default([]),
  source: z.string().default("system"),
  /** The plan version the change left; an undo is possible only while the plan is still there. */
  versionAfter: z.int().nullable().default(null),
});

export type PlanChangePayload = z.infer<typeof planChangePayloadSchema>;

/** Stored as JSON: the same fields, typed the way the database takes them. */
const jsonPayloadSchema = z.record(z.string(), z.json());

export type StoredPlanChangePayload = z.infer<typeof jsonPayloadSchema>;

export function parsePlanChangePayload(value: unknown): PlanChangePayload {
  const parsed = planChangePayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : planChangePayloadSchema.parse({});
}

/** Builds a payload with every field present, ready to store as JSON. */
export function toPlanChangePayload(
  payload: Partial<Omit<PlanChangePayload, "effect">> & { effect?: PlanEffect | null },
): StoredPlanChangePayload {
  return jsonPayloadSchema.parse(planChangePayloadSchema.parse(payload));
}
