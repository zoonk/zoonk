import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { anyPlanOperationSchema } from "../plan-contract";
import { type PlanEffect } from "../planner/plan-effect";
import { planPreviewBasisSchema } from "./plan-preview-basis";

const PLAN_CHANGE_KINDS = [
  "coverageChanged",
  "edited",
  "estimateUpdated",
  "missedDays",
  "noticeChanged",
  "relearn",
  "resumed",
  "testedOut",
] as const;

export type PlanChangeKind = (typeof PLAN_CHANGE_KINDS)[number];

export const UNDOABLE_KINDS: ReadonlySet<string> = new Set<PlanChangeKind>([
  "edited",
  "relearn",
  "testedOut",
]);

export function isUndoableChange(change: {
  kind: string;
  payload?: unknown;
  status: string;
}): boolean {
  return (
    UNDOABLE_KINDS.has(change.kind) &&
    change.status === "applied" &&
    (change.kind !== "relearn" || Boolean(parsePlanChangePayload(change.payload).livingPlanDay))
  );
}

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
  noticeRemoved: z.array(z.string()).optional(),
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
  unwrittenLeftOut: z.array(z.object({ lessons: z.int(), skill: z.string() })).optional(),
  weeklyEvents: z
    .object({ after: z.int(), before: z.int(), kind: z.enum(["challenge", "mock"]) })
    .optional(),
});

const planChangePayloadSchema = z.object({
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
  carriedItemIds: z.array(z.string()).default([]),
  days: z.int().nullable().default(null),
  effect: planEffectSchema.nullable().default(null),
  fromProposal: z.boolean().default(false),
  lessonHoldKey: z.string().optional(),
  lessonsSkipped: z.int().min(0).nullable().default(null),
  lineSkillIds: z.array(uuidSchema()).optional(),
  livingPlanDay: z.iso.date().optional(),
  mockSchedule: z.object({ from: z.iso.date(), to: z.iso.date().nullable() }).optional(),
  noticeId: z.string().nullable().default(null),
  officialDate: z
    .object({ date: z.iso.date(), source: z.string().nullable() })
    .nullable()
    .default(null),
  operations: z.array(anyPlanOperationSchema).default([]),
  planItemIds: z.array(z.string()).default([]),
  previewBasis: planPreviewBasisSchema.nullable().default(null),
  recheckedSkillIds: z.array(z.string()).default([]),
  /** The product release a "What's new" offer is for, so a plan gets one offer per release. */
  releaseId: z.string().nullable().default(null),
  replannedSince: z.literal(true).optional(),
  seenAt: z.iso.datetime().nullable().default(null),
  source: z.string().default("system"),
  startedPastSkillIds: z.array(uuidSchema()).optional(),
  /** The test's own reschedule is part of its undo, unlike a refresh that lands new lessons. */
  testOutRescheduled: z.literal(true).optional(),
  testReceipt: z.string().optional(),
  todaySession: z.enum(["changed", "unchanged"]).nullable().default(null),
  undoneAt: z.iso.datetime().optional(),
  versionAfter: z.int().nullable().default(null),
});

export type PlanChangePayload = z.infer<typeof planChangePayloadSchema>;

const jsonPayloadSchema = z.record(z.string(), z.json());

export type StoredPlanChangePayload = z.infer<typeof jsonPayloadSchema>;

export function parsePlanChangePayload(value: unknown): PlanChangePayload {
  const parsed = planChangePayloadSchema.safeParse(value);
  return parsed.success ? parsed.data : planChangePayloadSchema.parse({});
}

export function toPlanChangePayload(
  payload: Partial<Omit<PlanChangePayload, "effect">> & { effect?: PlanEffect | null },
): StoredPlanChangePayload {
  return jsonPayloadSchema.parse(planChangePayloadSchema.parse(payload));
}
