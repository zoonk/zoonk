import "server-only";
import { type LessonQuestionContextSnapshot } from "@zoonk/ai/tasks/lessons/question-context";
import { GOAL_TUTOR_PAGES } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-pages";
import { z } from "zod";
import { screenSnapshotSchema, standaloneScreenSnapshotSchema } from "./screen-snapshot-schema";

const courseLevelSchema = z.object({
  chapters: z.array(z.string()),
  inPlan: z.boolean(),
  level: z.string(),
});

const courseOutlineSchema = z.object({
  description: z.string().nullable(),
  levels: z.array(courseLevelSchema),
  targetLanguage: z.string().nullable(),
  title: z.string(),
});

const PLAN_ITEM_REASONS = [
  "checkpoint",
  "extraPractice",
  "fullReview",
  "mistakes",
  "newSkill",
  "produce",
  "reinforcement",
  "reviewDue",
  "weakArea",
] as const;

/** A mock exam the learner's plan doesn't include stays on its day, marked as Plus's. */
const plusMarkSchema = z.literal(true).optional();

/** Where something opens in the app (see `TutorLink`); null or absent when it opens nowhere. */
const tutorLinkSchema = z
  .discriminatedUnion("kind", [
    z.object({ blockId: z.string(), kind: z.literal("block") }),
    z.object({ kind: z.literal("challenge"), planItemId: z.string() }),
    z.object({ kind: z.literal("page"), page: z.enum(GOAL_TUTOR_PAGES) }),
    z.object({ key: z.string(), kind: z.literal("subject") }),
  ])
  .nullable();

const planNextItemSchema = z.object({
  kind: z.string(),
  link: tutorLinkSchema.optional(),
  plusRequired: plusMarkSchema,
  title: z.string(),
});

const planScopeSnapshotSchema = z.object({
  catchUp: z
    .object({
      lessons: z.array(
        z.object({ inToday: z.boolean(), link: tutorLinkSchema, title: z.string() }),
      ),
      offeredToday: z.boolean(),
      total: z.number().int(),
    })
    .nullable(),
  challenges: z.array(
    z.object({
      date: z.string().nullable(),
      kind: z.enum(["challenge", "mock", "weekly"]),
      link: tutorLinkSchema,
      locked: z.boolean(),
      when: z.enum(["date", "nextSession", "queued"]),
    }),
  ),
  course: courseOutlineSchema.nullable(),
  estimate: z.object({ endDate: z.string().nullable(), remainingHours: z.number() }),
  exam: z
    .object({
      days: z.array(z.object({ date: z.string(), label: z.string().nullable() })),
      formats: z.array(z.string()),
      fromMaterial: z.boolean(),
      name: z.string(),
      official: z.boolean(),
      otherDates: z.array(z.object({ date: z.string(), label: z.string() })),
      questionCount: z.number().nullable(),
      questionsSource: z
        .object({ edition: z.string().nullable(), title: z.string().nullable(), url: z.string() })
        .nullable(),
      rules: z.array(z.string()),
      scoring: z.string().nullable(),
      source: z.string().nullable(),
      subjects: z.array(
        z.object({
          fromLatestEdition: z.literal(true).optional(),
          group: z.string().nullable(),
          name: z.string(),
          questions: z.number().nullable(),
        }),
      ),
    })
    .nullable(),
  goal: z.object({
    cutoff: z
      .object({
        edition: z.string().nullable(),
        maxScore: z.number(),
        quota: z.string().nullable(),
        score: z.number(),
        source: z.string(),
        target: z.string(),
      })
      .nullable(),
    dailyMinutes: z.number(),
    kind: z.string(),
    target: z.string().nullable(),
    targetDate: z.string().nullable(),
    title: z.string(),
  }),
  language: z.string(),
  mistakes: z.array(
    z.object({
      answer: z.string().nullable(),
      correctAnswer: z.string().nullable(),
      question: z.string(),
      skill: z.string().nullable(),
    }),
  ),
  next: z.array(
    z.object({ date: z.string(), items: z.array(planNextItemSchema), moreItems: z.number().int() }),
  ),
  phase: z
    .object({
      chapters: z.array(
        z.object({
          lessonsDone: z.number(),
          lessonsTotal: z.number(),
          state: z.string(),
          title: z.string(),
        }),
      ),
      chaptersDone: z.number().int(),
      chaptersLater: z.number().int(),
      endDate: z.string().nullable(),
      index: z.number(),
      kind: z.string(),
      name: z.string(),
    })
    .nullable(),
  // Questions asked before private content was marked have none: they read as private.
  privateContent: z.boolean().default(true),
  scope: z.object({ kind: z.literal("plan") }),
  // Questions to the buddy from its own conversation have no screen.
  screen: screenSnapshotSchema.optional(),
  // Questions asked from a screen have none.
  selectedGoal: z.literal(true).optional(),
  setup: z
    .object({
      areas: z.array(
        z.object({
          focusPart: z.string().nullable(),
          focused: z.boolean(),
          name: z.string(),
          pastBasics: z.boolean(),
          reduced: z.boolean(),
          skipped: z.boolean(),
        }),
      ),
      coverage: z
        .object({
          coreFits: z.boolean(),
          coveredShare: z.number(),
          fits: z.boolean(),
          measure: z.enum(["exam", "goal"]),
        })
        .nullable(),
      difficultyBias: z.string(),
      lightWeeks: z.array(z.object({ endDate: z.string(), startDate: z.string() })),
      ownLevel: z.string().nullable(),
      practiceBias: z.string(),
      weekdayMinutes: z.array(z.number()),
      writtenCadence: z.string().nullable(),
    })
    .nullable(),
  status: z
    .object({
      challenges: z.number().nullable(),
      days: z.number().nullable(),
      extraMinutesPerDay: z.number().nullable(),
      kind: z.enum([
        "ahead",
        "behind",
        "challengesLeft",
        "finished",
        "needsAdjusting",
        "onTrack",
        "pastDate",
      ]),
      lessons: z.number().nullable(),
      options: z.array(z.string()),
    })
    .nullable(),
  today: z
    .object({
      date: z.string(),
      items: z.array(
        z.object({
          canDo: z.string().nullable(),
          catchUp: z.literal(true).optional(),
          kind: z.string(),
          link: tutorLinkSchema.optional(),
          minutes: z.number().nullable(),
          plusRequired: plusMarkSchema,
          reason: z.enum(PLAN_ITEM_REASONS),
          status: z.string(),
          title: z.string().nullable(),
        }),
      ),
      source: z.enum(["plan", "session"]),
    })
    .nullable(),
  version: z.literal(1),
});

const lessonQuestionContextSnapshotSchema = z.union([
  standaloneScreenSnapshotSchema,
  planScopeSnapshotSchema,
]);

const databaseContextSnapshotSchema = z.record(z.string(), z.json());

export function parseLessonQuestionContextSnapshot(value: unknown): LessonQuestionContextSnapshot {
  return lessonQuestionContextSnapshotSchema.parse(value);
}

export function toDatabaseLessonQuestionContextSnapshot(snapshot: LessonQuestionContextSnapshot) {
  return databaseContextSnapshotSchema.parse(snapshot);
}
