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
  .nullable()
  .optional();

const planNextItemSchema = z.object({
  kind: z.string(),
  link: tutorLinkSchema,
  plusRequired: plusMarkSchema,
  title: z.string(),
});

const planScopeSnapshotSchema = z.object({
  // Plan questions asked before the buddy saw what earlier days left have none.
  catchUp: z
    .object({
      lessons: z.array(
        z.object({ inToday: z.boolean(), link: tutorLinkSchema.default(null), title: z.string() }),
      ),
      offeredToday: z.boolean(),
      total: z.number().int(),
    })
    .nullable()
    .optional(),
  // Plan questions asked before the buddy saw the challenges ahead have none.
  challenges: z
    .array(
      z.object({
        date: z.string().nullable(),
        kind: z.enum(["challenge", "mock", "weekly"]),
        link: tutorLinkSchema.default(null),
        locked: z.boolean(),
        when: z.enum(["date", "nextSession", "queued"]),
      }),
    )
    .optional(),
  course: courseOutlineSchema.nullable(),
  estimate: z.object({ endDate: z.string().nullable(), remainingHours: z.number() }),
  // Plan questions asked before the buddy read the exam's notice have no exam facts.
  exam: z
    .object({
      days: z.array(z.object({ date: z.string(), label: z.string().nullable() })),
      formats: z.array(z.string()),
      fromMaterial: z.boolean(),
      name: z.string(),
      official: z.boolean(),
      otherDates: z.array(z.object({ date: z.string(), label: z.string() })),
      questionCount: z.number().nullable(),
      // Snapshots saved before the counts came from the latest edition when the notice gives none.
      questionsSource: z
        .object({ edition: z.string().nullable(), title: z.string().nullable(), url: z.string() })
        .nullable()
        .optional(),
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
    .nullable()
    .optional(),
  goal: z.object({
    // Plan questions asked before the buddy knew the target's last cut-off have none, and those
    // asked before it knew the cut-off's scale have no `maxScore`.
    cutoff: z
      .object({
        edition: z.string().nullable(),
        maxScore: z.number().optional(),
        quota: z.string().nullable(),
        score: z.number(),
        source: z.string(),
        target: z.string(),
      })
      .nullable()
      .optional(),
    dailyMinutes: z.number(),
    kind: z.string(),
    target: z.string().nullable().optional(),
    targetDate: z.string().nullable(),
    title: z.string(),
  }),
  language: z.string(),
  // Plan questions asked before the buddy became the goal's tutor have no mistakes or setup.
  mistakes: z
    .array(
      z.object({
        answer: z.string().nullable(),
        correctAnswer: z.string().nullable(),
        question: z.string(),
        skill: z.string().nullable(),
      }),
    )
    .optional(),
  next: z.array(
    z.object({
      date: z.string(),
      items: z.array(planNextItemSchema),
      moreItems: z.number().int().optional(),
    }),
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
      // Snapshots saved before the phase listed only the chapters ahead listed all of them.
      chaptersDone: z.number().int().optional(),
      chaptersLater: z.number().int().optional(),
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
  // Questions asked from a screen, or before the buddy linked the open goal, have none.
  selectedGoal: z.literal(true).optional(),
  setup: z
    .object({
      areas: z.array(
        z.object({
          // Snapshots saved before a focus could name part of an area.
          focusPart: z.string().nullable().default(null),
          focused: z.boolean(),
          name: z.string(),
          // Snapshots saved before areas could start past their basics.
          pastBasics: z.boolean().default(false),
          // Snapshots saved before the learner could ask for less of an area.
          reduced: z.boolean().default(false),
          skipped: z.boolean(),
        }),
      ),
      coverage: z
        .object({
          // Snapshots saved before plans kept every topic in counted whole skills.
          coreFits: z.boolean().default(true),
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
      // Plans saved before the exam's written tests had a cadence have none.
      writtenCadence: z.string().nullable().optional(),
    })
    .optional(),
  status: z
    .object({
      // Snapshots saved before challenges counted toward a finished plan have none.
      challenges: z.number().nullable().optional(),
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
      lessons: z.number().nullable().optional(),
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
          link: tutorLinkSchema,
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
