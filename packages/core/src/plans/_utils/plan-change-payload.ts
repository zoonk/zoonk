import { z } from "zod";
import { anyPlanOperationSchema } from "../plan-contract";
import { type PlanEffect } from "../planner/plan-effect";
import { planGraphSchema, planStateSchema } from "../planner/plan-state";

/**
 * What happened to a plan. `edited`: the learner or a proposal changed how it's shaped (undoable).
 * `testedOut`: placement or a test-out skipped lessons (undoable). `missedDays`: lessons earlier
 * days left came first and the rest moved forward. `estimateUpdated`: the pace estimate got more
 * precise. `resumed`: a paused goal started again from today.
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
  areaStarts: z
    .array(
      z.object({ after: z.string().nullable(), area: z.string(), before: z.string().nullable() }),
    )
    .optional(),
  endDateAfter: z.string().nullable(),
  endDateBefore: z.string().nullable(),
  lessonsAdded: z.int(),
  lessonsRemoved: z.int(),
  reviewFirst: z.object({ areas: z.array(z.string()), date: z.string() }).optional(),
  topicsAdded: z.array(z.object({ area: z.string(), topics: z.array(z.string()) })).optional(),
  topicsLeftOut: z.array(z.object({ area: z.string(), topics: z.array(z.string()) })).optional(),
  weeklyEvents: z
    .object({ after: z.int(), before: z.int(), kind: z.enum(["challenge", "mock"]) })
    .optional(),
});

const planChangePayloadSchema = z.object({
  /** The state before an applied edit, which its undo restores. */
  before: planStateSchema.nullable().default(null),
  /**
   * For `missedDays`: falling behind made the plan cover less of its goal by its date (see
   * `FallingBehind`), so Today asks what the learner wants. Null when the date isn't at risk.
   */
  behind: z
    .object({
      canFocus: z.boolean(),
      coveredAfter: z.number(),
      coveredBefore: z.number(),
      currentMinutes: z.int().default(0),
      dailyMinutes: z.int().nullable(),
      fullDepth: z.boolean(),
      measure: z.enum(["exam", "goal"]),
    })
    .nullable()
    .default(null),
  /**
   * For `missedDays`: the plan items earlier days left, which the new day settled first: while they
   * aren't done, the learner is catching up (see `loadCatchUpItems`).
   */
  carriedItemIds: z.array(z.string()).default([]),
  /** For `missedDays`: the earlier days that left lessons, now first on the plan. */
  days: z.int().nullable().default(null),
  effect: planEffectSchema.nullable().default(null),
  /**
   * The graph a `followNotice` change makes the plan follow: the one the reconciliation with the
   * exam's notice wrote. Kept here, not in `operations`, since clients never need it.
   */
  noticeGraph: planGraphSchema.nullable().default(null),
  /**
   * The exam notice's change message the change answers, so Today shows the change and its Apply
   * instead of the same news twice.
   */
  noticeId: z.string().nullable().default(null),
  /** The exam day the notice sets, when the change moves the goal's date off it. */
  officialDate: z
    .object({ date: z.iso.date(), source: z.string().nullable() })
    .nullable()
    .default(null),
  operations: z.array(anyPlanOperationSchema).default([]),
  /**
   * Items a test-out skipped, which its undo brings back. How many there are is the lessons it
   * skipped, as the plan's rows and the test-out's result count them.
   */
  planItemIds: z.array(z.string()).default([]),
  /**
   * When the learner said "Got it" to an applied change: the plan stops showing it. Null until then,
   * and for proposals.
   */
  seenAt: z.iso.datetime().nullable().default(null),
  source: z.string().default("system"),
  /**
   * For a change the learner made or applied: whether today's session took it right away
   * (`changed`) or stays as it was, underway or done, so it starts on the next study day
   * (`unchanged`). Null when there was no session yet today, and for other changes.
   */
  todaySession: z.enum(["changed", "unchanged"]).nullable().default(null),
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
