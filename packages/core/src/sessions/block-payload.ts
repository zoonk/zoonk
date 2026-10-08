import { type StudySessionBlock } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { z } from "zod";
import { MISTAKE_DRILL_KINDS } from "../mistakes/mistake-drills";
import { CAPSULE_FORMATS } from "./capsules";

const capsuleSchema = z.object({
  format: z.enum(CAPSULE_FORMATS),
  itemIds: z.array(z.string()),
  /** The lesson that taught the capsule's ideas, or `skill:<id>` for a skill without one. */
  key: z.string(),
  lessonId: z.string().nullable(),
  skillIds: z.array(z.string()),
  title: z.string(),
});

/**
 * A targeted drill for one saved mistake: its question first, then a few more on its skill, played
 * the way its cause calls for (the lesson again first for a content gap, a time box for running out
 * of time). A drill without a kind is a plain retry.
 */
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
  passMark: z.number().int(),
  phase: z.number().int().nullable(),
  /** A boss lost on an earlier day, back after reinforcement lessons. */
  rematch: z.boolean().default(false),
  timeLimitMinutes: z.number().int().nullable(),
});

/**
 * What a block needs, as plain ids fixed when the session is built, so the same session always
 * asks the same questions. Missing fields read as empty.
 */
const blockPayloadSchema = z.object({
  /** A chapter's "Practice now": the area it practices, so a second tap finds it. */
  areaId: z.string().nullable().default(null),
  capsules: z.array(capsuleSchema).default([]),
  /** A chapter whose next lesson isn't written yet: it's generated just in time. */
  chapterId: z.string().nullable().default(null),
  checkpoint: checkpointSchema.nullable().default(null),
  drills: z.array(drillSchema).default([]),
  /** "10 more minutes" after the day's session: its Brain Power is capped. */
  extra: z.boolean().default(false),
  /**
   * Practice on every skill of the goal, weakest first, on a day whose mock the learner's plan
   * doesn't include: it stands in for the mock as the test in real conditions preparation waits
   * for (see `getPreparationValue`).
   */
  fullReview: z.boolean().default(false),
  itemIds: z.array(z.string()).default([]),
  /**
   * Practice for an exam where a wrong answer cancels a right one (Cebraspe): it's scored net and
   * statements can be left blank, as in the exam. Swipe capsules are scored net on their own.
   */
  netScored: z.boolean().default(false),
  /**
   * Placement questions for skills whose starting point isn't settled yet, asked first in the goal's
   * first week: day 1 has a few minutes of placement, and the sessions carry the rest.
   */
  placementItemIds: z.array(z.string()).default([]),
  planItemId: z.string().nullable().default(null),
  /**
   * The plan's skill a lesson block stands for, kept with the block so its subject still shows
   * when a re-plan removes its plan item while the lesson is on today's list.
   */
  planSkillId: z.string().nullable().default(null),
  /** A short lesson before a boss rematch, on the skills the lost duel missed. */
  reinforcement: z.boolean().default(false),
  skillIds: z.array(z.string()).default([]),
  title: z.string().nullable().default(null),
});

export type BlockPayload = z.infer<typeof blockPayloadSchema>;
export type BlockCapsule = z.infer<typeof capsuleSchema>;
export type BlockCheckpoint = z.infer<typeof checkpointSchema>;
export type BlockDrill = z.infer<typeof drillSchema>;

const EMPTY_BLOCK_PAYLOAD: BlockPayload = blockPayloadSchema.parse({});

/** Builds a payload from the fields a block uses; the rest stay empty. */
export function toBlockPayload(fields: Partial<BlockPayload>): BlockPayload {
  return { ...EMPTY_BLOCK_PAYLOAD, ...fields };
}

/**
 * Reads a stored payload. The session wrote it, so a parse failure means corrupted data: it's
 * logged and the block reads as empty instead of breaking the learner's day.
 */
export function readBlockPayload(block: Pick<StudySessionBlock, "id" | "payload">): BlockPayload {
  const parsed = blockPayloadSchema.safeParse(block.payload);

  if (!parsed.success) {
    logError(`Study block ${block.id} has a payload that doesn't match its schema.`, parsed.error);
    return EMPTY_BLOCK_PAYLOAD;
  }

  return parsed.data;
}

/**
 * Every question a block asks, in order: placement questions, capsules, then mistake drills, then
 * the rest.
 */
export function getBlockItemIds(payload: BlockPayload): string[] {
  return [
    ...payload.placementItemIds,
    ...payload.capsules.flatMap((capsule) => capsule.itemIds),
    ...payload.drills.flatMap((drill) => drill.itemIds),
    ...payload.itemIds,
  ];
}
