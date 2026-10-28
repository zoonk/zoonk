import { z } from "zod";
import { anyPlanOperationSchema } from "../plan-contract";
import { type PlanEffect } from "../planner/plan-effect";
import { planGraphSchema } from "../planner/plan-state";
import { planPreviewBasisSchema } from "./plan-preview-basis";

/**
 * What happened to a plan. `edited`: the learner or a proposal changed how it's shaped (undoable).
 * `testedOut`: placement or a test-out skipped lessons (undoable). `missedDays`: lessons earlier
 * days left came first and the rest moved forward. `estimateUpdated`: the lesson count changed
 * by more than the shared threshold as pace data or written lessons changed its estimates.
 * `resumed`: a paused goal started again from today. `relearn`: a miss in practice on a
 * topic the learner was taken to know brought its lessons back (`effect.topicsAdded` names it).
 * `coverageChanged`: placement answers changed which topics fit by the date (`effect.topicsLeftOut` and `effect.topicsAdded` name them).
 */
const PLAN_CHANGE_KINDS = [
  "coverageChanged",
  "edited",
  "estimateUpdated",
  "missedDays",
  "relearn",
  "resumed",
  "testedOut",
] as const;

export type PlanChangeKind = (typeof PLAN_CHANGE_KINDS)[number];

const UNDOABLE_KINDS: ReadonlySet<string> = new Set<PlanChangeKind>(["edited", "testedOut"]);

/** An applied edit or test-out: the learner can undo it while the plan is as it left it. */
export function isUndoableChange(change: { kind: string; status: string }): boolean {
  return UNDOABLE_KINDS.has(change.kind) && change.status === "applied";
}

/**
 * Who asked for a change: "learner" in the app, "planEdit" (the AI reading their words), "system"
 * for re-planning, or the part of core that proposed it, such as "memory" or "preparation".
 */
export type PlanChangeSource = string;

export const planEffectSchema = z.object({
  addedTopicsBeforeBasics: z.literal(true).optional(),
  addedTopicsStart: z.string().optional(),
  areaEnds: z
    .array(
      z.object({
        after: z.string(),
        area: z.string(),
        before: z.string(),
        lessonsGained: z.int().optional(),
      }),
    )
    .optional(),
  areaLessons: z.array(z.object({ after: z.int(), area: z.string(), before: z.int() })).optional(),
  areaStarts: z
    .array(
      z.object({ after: z.string().nullable(), area: z.string(), before: z.string().nullable() }),
    )
    .optional(),
  endDateAfter: z.string().nullable(),
  endDateBefore: z.string().nullable(),
  fromPlacement: z.literal(true).optional(),
  lessonsAdded: z.int(),
  lessonsAddedEstimated: z.literal(true).optional(),
  lessonsLeftOut: z.array(z.string()).optional(),
  lessonsRemoved: z.int(),
  listeningPastBasics: z.array(z.string()).optional(),
  nextMock: z.object({ after: z.string(), before: z.string() }).optional(),
  outcomesAdded: z.array(z.string()).optional(),
  phaseEnds: z
    .array(
      z.object({
        after: z.string(),
        before: z.string(),
        lessonsFirst: z.literal(true).optional(),
        name: z.string(),
        restDay: z.literal(true).optional(),
      }),
    )
    .optional(),
  reviewFirst: z.object({ areas: z.array(z.string()), date: z.string() }).optional(),
  topicsAdded: z.array(z.object({ area: z.string(), topics: z.array(z.string()) })).optional(),
  topicsLeftOut: z.array(z.object({ area: z.string(), topics: z.array(z.string()) })).optional(),
  weeklyEvents: z
    .object({ after: z.int(), before: z.int(), kind: z.enum(["challenge", "mock"]) })
    .optional(),
});

const planChangePayloadSchema = z.object({
  /**
   * When the learner said "Got it" to an applied change: the plan stops showing it. Null until then,
   * and for proposals.
   */
  /** Replay binding for an acknowledged computed Today notice, never a client-supplied row ID. */
  acknowledgedRead: z
    .object({ inputVersion: z.number().int(), studyDay: z.iso.date(), version: z.number().int() })
    .strict()
    .optional(),
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
      measure: z.enum(["exam", "goal"]),
    })
    .nullable()
    .default(null),
  /**
   * For `missedDays`: the plan items earlier days left, which the new day settled first: while they
   * aren't done, the learner is catching up (see `loadCatchUpItems`). For `resumed`: those a pause
   * left, which the resume settled first the same way, without being behind. For `relearn`: the
   * lessons a miss brought back, which later runs that day keep first too (see `loadPlanCarryOver`).
   */
  carriedItemIds: z.array(z.string()).default([]),
  /** For `missedDays`: the earlier days that left lessons, now first on the plan. */
  days: z.int().nullable().default(null),
  effect: planEffectSchema.nullable().default(null),
  /**
   * The change waited for the learner's OK and they applied it (a proposal): undoing it puts it
   * back to waiting, as it was before Apply (see `undoChange`).
   */
  fromProposal: z.boolean().default(false),
  /**
   * For `testedOut`: the lessons it skipped as every screen counts them (`countLessons`, a stand-in
   * the lessons the plan taught in its place), so Today's "We skipped 235 lessons you already know"
   * adds up with the Plan's subjects. Null for every other kind.
   */
  lessonsSkipped: z.int().min(0).nullable().default(null),
  /**
   * The notice edition a `followNotice` change follows (see `getNoticeEdition`): the learner's
   * "Keep mine" holds for that edition, and a new one is offered once again.
   */
  noticeEdition: z.string().nullable().default(null),
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
  /** Items a test-out skipped, which its undo brings back. */
  planItemIds: z.array(z.string()).default([]),
  previewBasis: planPreviewBasisSchema.nullable().default(null),
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
