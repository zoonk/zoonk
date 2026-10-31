import { type StudySessionBlock } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";
import { brainPowerRewardSchema } from "../milestones/milestone-reward";
import { MISTAKE_DRILL_KINDS } from "../mistakes/mistake-drills";
import { CAPSULE_FORMATS } from "./capsules";
import { mockIdentitySchema } from "./day-block";
import { MISSION_KINDS } from "./missions/catalog";

const capsuleSchema = z.object({
  format: z.enum(CAPSULE_FORMATS),
  itemIds: z.array(z.string()),
  /** The lesson that taught the capsule's ideas, or `skill:<id>` for a skill without one. */
  key: z.string(),
  lessonId: z.string().nullable(),
  skillIds: z.array(z.string()),
  title: z.string(),
});

/** A missing drill kind means a plain retry. */
const drillSchema = z.object({
  itemIds: z.array(z.string()),
  kind: z.enum(MISTAKE_DRILL_KINDS).default("retry"),
  lessonId: z.string().nullable().default(null),
  mistakeId: z.string(),
  timeLimitSeconds: z.number().int().positive().nullable().default(null),
});

const checkpointSchema = z.object({
  kind: z.enum(["boss", "finalBoss", "weekly"]),
  /** Weekly Big Challenges of exam goals are mock exams: they feed the estimated score. */
  mock: z.boolean(),
  mockIdentity: mockIdentitySchema.optional(),
  passMark: z.number().int(),
  phase: z.number().int().nullable(),
  /** A boss lost on an earlier day, back after reinforcement lessons. */
  rematch: z.boolean().default(false),
  timeLimitMinutes: z.number().int().nullable(),
});

/** Freeze question ids at build time so revisits ask the same questions. */
const blockPayloadSchema = z.object({
  /** A chapter's "Practice now": the area it practices, so a second tap finds it. */
  areaId: z.string().nullable().default(null),
  capsules: z.array(capsuleSchema).default([]),
  /** A chapter whose next lesson isn't written yet: it's generated just in time. */
  chapterId: z.string().nullable().default(null),
  checkpoint: checkpointSchema.nullable().default(null),
  /** A started checkpoint ended without a verdict because none of its questions remained. */
  checkpointAbandoned: z.boolean().default(false),
  /** Question identities survive content deletion while a checkpoint is still being played. */
  checkpointAnswers: z.array(z.object({ attemptId: z.uuid(), itemId: z.uuid() })).default([]),
  drills: z.array(drillSchema).default([]),
  /** The retained locked calls whose freed time this once-only entitlement replacement filled. */
  entitlementReplacementFor: z.array(z.uuid()).default([]),
  /** Extra study earns capped Brain Power. */
  extra: z.boolean().default(false),
  /** Stands in for a missing mock as preparation's test in real conditions. */
  fullReview: z.boolean().default(false),
  itemIds: z.array(z.string()).default([]),
  /** The paid completion's evidence survives retries without rescoring its answers. */
  milestoneReward: z
    .object({ bossWon: z.boolean(), brainPower: brainPowerRewardSchema })
    .nullable()
    .default(null),
  /** Retain the earned mission moment so retries and redraws return the same result. */
  missionResult: z
    .object({ completed: z.array(z.enum(MISSION_KINDS)), fullMealPaid: z.boolean() })
    .nullable()
    .default(null),
  /** Wrong answers cancel right ones and blanks are allowed; swipe capsules score net separately. */
  netScored: z.boolean().default(false),
  /** Unsettled placement questions lead the first week's sessions. */
  placementItemIds: z.array(z.string()).default([]),
  planItemId: z.string().nullable().default(null),
  planItemKey: z.string().nullable().default(null),
  /** Retain the subject when re-planning removes the original plan item. */
  planSkillId: z.string().nullable().default(null),
  /** Content's "Review" of the goal's fading and due skills, so a second tap finds it. */
  refresh: z.boolean().default(false),
  /** A short lesson before a boss rematch, on the skills the lost duel missed. */
  reinforcement: z.boolean().default(false),
  skillIds: z.array(z.string()).default([]),
  /** Focused time survives switching blocks; only the most recently opened clock runs. */
  timing: z
    .object({
      activeAt: z.iso.datetime().nullable(),
      elapsedMs: z.number().nonnegative(),
      /** Focus already credited by a lesson run before its block's separate settlement. */
      recordedMs: z.number().nonnegative().optional(),
    })
    .nullable()
    .default(null),
  title: z.string().nullable().default(null),
  /** Nothing is due; use weak studied topics rather than leaving the day empty. */
  weakest: z.boolean().default(false),
});

export type BlockPayload = z.infer<typeof blockPayloadSchema>;
export type BlockCapsule = z.infer<typeof capsuleSchema>;
export type BlockCheckpoint = z.infer<typeof checkpointSchema>;
export type BlockDrill = z.infer<typeof drillSchema>;

const EMPTY_BLOCK_PAYLOAD: BlockPayload = blockPayloadSchema.parse({});

export function toBlockPayload(fields: Partial<BlockPayload>): BlockPayload {
  return { ...EMPTY_BLOCK_PAYLOAD, ...fields };
}

/** Logs invalid stored payloads and returns an empty payload rather than interrupting the day. */
export function readBlockPayload(
  block: Pick<StudySessionBlock, "payload"> & { id?: string },
): BlockPayload {
  const parsed = blockPayloadSchema.safeParse(block.payload);

  if (!parsed.success) {
    logError(
      `Study block ${block.id ?? "(unstarted)"} has a payload that doesn't match its schema.`,
      parsed.error,
    );

    return EMPTY_BLOCK_PAYLOAD;
  }

  return parsed.data;
}

export function getBlockItemIds(payload: BlockPayload): string[] {
  return [
    ...payload.placementItemIds,
    ...payload.capsules.flatMap((capsule) => capsule.itemIds),
    ...payload.drills.flatMap((drill) => drill.itemIds),
    ...payload.itemIds,
  ];
}
