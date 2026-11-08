import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const FOLLOW_UP_SECRET_HEADER = "x-zoonk-follow-up-secret";

const mistakeCauseInputSchema = z.object({
  correctAnswer: z.string(),
  language: z.string(),
  learnerAnswer: z.string(),
  misconception: z.string(),
  question: z.string(),
  recentAccuracy: z.string(),
});

export const followUpSchema = z.discriminatedUnion("kind", [
  z.object({
    input: z.object({ sessionId: uuidSchema(), timeZone: z.string() }),
    kind: z.literal("refreshStudyDay"),
  }),
  z.object({ input: z.object({ sessionId: uuidSchema() }), kind: z.literal("prepareSession") }),
  z.object({
    input: z.object({
      /** The block whose finish owes it. */
      blockId: uuidSchema().optional(),
      /** Unique to a write that skipped or removed blocks, when no block finished. */
      removalId: uuidSchema().optional(),
      rewardMissions: z.boolean().optional(),
      sessionId: uuidSchema(),
      source: z.object({ id: z.string(), kind: z.string() }).optional(),
      timeZone: z.string(),
    }),
    kind: z.literal("settleSessionDay"),
  }),
  z.object({
    input: z.object({ goalId: uuidSchema(), lessonsAskedAt: z.number().nullable() }),
    kind: z.literal("prepareGoalLessons"),
  }),
  z.object({ input: z.object({ lessonId: uuidSchema() }), kind: z.literal("writeLesson") }),
  z.object({
    input: z.object({ goalId: uuidSchema(), waitsForNotice: z.boolean() }),
    kind: z.literal("preparePlacementItems"),
  }),
  z.object({
    input: z.object({ cause: mistakeCauseInputSchema, mistakeId: uuidSchema() }),
    kind: z.literal("classifyMistakeCause"),
  }),
  z.object({ input: z.object({ language: z.string() }), kind: z.literal("findMistakePattern") }),
  z.object({ input: z.object({ goalId: uuidSchema() }), kind: z.literal("rememberOnboarding") }),
  z.object({
    input: z.object({
      endedAt: z.iso.datetime(),
      goalId: uuidSchema(),
      sessionId: uuidSchema(),
      timeZone: z.string(),
    }),
    kind: z.literal("rememberSession"),
  }),
  z.object({
    input: z.object({
      date: z.iso.date(),
      endedAt: z.iso.datetime(),
      goalId: uuidSchema(),
      timeZone: z.string(),
    }),
    kind: z.literal("checkDailyInsight"),
  }),
  z.object({
    input: z.object({ factId: uuidSchema(), statement: z.string() }),
    kind: z.literal("checkFactSensitivity"),
  }),
  z.object({
    input: z.object({ orgSlug: z.string(), targetLanguage: z.string(), wordId: uuidSchema() }),
    kind: z.literal("voiceWord"),
  }),
  z.object({ input: z.object({ mockId: uuidSchema() }), kind: z.literal("writeSpeakingPaper") }),
  z.object({
    input: z.object({ lessonId: uuidSchema(), version: z.number().int() }),
    kind: z.literal("reviewAlphabetLesson"),
  }),
  z.object({
    input: z.object({ sourceId: uuidSchema() }),
    kind: z.literal("checkUploadVisibility"),
  }),
  z.object({ input: z.object({}), kind: z.literal("endWebPlusBesideStore") }),
  z.object({
    input: z.object({
      locale: z.string(),
      store: z.enum(["apple", "google"]),
      subscriptionId: uuidSchema(),
    }),
    kind: z.literal("askToCancelSecondStorePlus"),
  }),
]);

export type FollowUp = z.infer<typeof followUpSchema>;

/** A saved row: its `revision` ends it only if nobody asked for the same work again since it was read. */
export type OwedFollowUp = FollowUp & { id: string; key: string; revision: number; userId: string };
