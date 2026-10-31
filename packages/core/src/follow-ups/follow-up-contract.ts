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
  z.object({ input: z.object({ sessionId: z.uuid() }), kind: z.literal("prepareSession") }),
  z.object({
    input: z.object({ goalId: z.uuid(), lessonsAskedAt: z.number().nullable() }),
    kind: z.literal("prepareGoalLessons"),
  }),
  z.object({ input: z.object({ lessonId: z.uuid() }), kind: z.literal("writeLesson") }),
  z.object({
    input: z.object({ cause: mistakeCauseInputSchema, mistakeId: z.uuid() }),
    kind: z.literal("classifyMistakeCause"),
  }),
  z.object({ input: z.object({ language: z.string() }), kind: z.literal("findMistakePattern") }),
  z.object({ input: z.object({ goalId: z.uuid() }), kind: z.literal("rememberOnboarding") }),
  z.object({
    input: z.object({
      endedAt: z.iso.datetime(),
      goalId: z.uuid(),
      sessionId: z.uuid(),
      timeZone: z.string(),
    }),
    kind: z.literal("rememberSession"),
  }),
  z.object({
    input: z.object({
      date: z.iso.date(),
      endedAt: z.iso.datetime(),
      goalId: z.uuid(),
      timeZone: z.string(),
    }),
    kind: z.literal("checkDailyInsight"),
  }),
  z.object({
    input: z.object({ factId: z.uuid(), statement: z.string() }),
    kind: z.literal("checkFactSensitivity"),
  }),
  z.object({
    input: z.object({ orgSlug: z.string(), targetLanguage: z.string(), wordId: z.uuid() }),
    kind: z.literal("voiceWord"),
  }),
  z.object({ input: z.object({ mockId: z.uuid() }), kind: z.literal("writeSpeakingPaper") }),
]);

export type FollowUp = z.infer<typeof followUpSchema>;

/** A saved row: its `revision` ends it only if nobody asked for the same work again since it was read. */
export type OwedFollowUp = FollowUp & { id: string; key: string; revision: number; userId: string };
