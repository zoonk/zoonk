import "server-only";
import { type LessonQuestionContextSnapshot } from "@zoonk/ai/tasks/lessons/question-context";
import { z } from "zod";

const lessonQuestionStepContextSchema = z.object({
  content: z.unknown(),
  kind: z.string(),
  sentence: z
    .object({
      explanation: z.string().nullable(),
      romanization: z.string().nullable(),
      sentence: z.string(),
      translation: z.string(),
    })
    .nullable(),
  stepNumber: z.number().int().min(1),
  word: z
    .object({
      pronunciation: z.string().nullable(),
      romanization: z.string().nullable(),
      translation: z.string(),
      word: z.string(),
    })
    .nullable(),
});

const lessonScopeSnapshotSchema = z.object({
  answer: z
    .object({
      correctAnswer: z.string().nullable(),
      feedback: z.string().nullable(),
      isCorrect: z.boolean(),
      selectedAnswer: z.string(),
    })
    .nullable()
    .default(null),
  chapter: z.object({ description: z.string().nullable(), title: z.string() }),
  course: z.object({
    description: z.string().nullable(),
    language: z.string(),
    targetLanguage: z.string().nullable(),
    title: z.string(),
  }),
  lesson: z.object({
    description: z.string().nullable(),
    kind: z.string(),
    language: z.string(),
    title: z.string().nullable(),
  }),
  lessonSteps: z.array(lessonQuestionStepContextSchema),
  scope: z.object({ kind: z.enum(["answer", "lesson", "step"]) }),
  step: lessonQuestionStepContextSchema.nullable(),
  version: z.literal(1),
});

const chapterScopeSnapshotSchema = z.object({
  chapter: z.object({
    description: z.string(),
    level: z.string(),
    objectives: z.array(z.string()),
    title: z.string(),
  }),
  course: z.object({ title: z.string() }).nullable(),
  language: z.string(),
  lessons: z.array(
    z.object({
      canDo: z.string().nullable(),
      description: z.string(),
      finished: z.boolean(),
      title: z.string(),
    }),
  ),
  scope: z.object({ kind: z.literal("chapter") }),
  version: z.literal(1),
});

/** Snapshots saved before the outline kept only titles listed each chapter's lessons too. */
const courseChapterTitleSchema = z.union([
  z.string(),
  z.object({ title: z.string() }).transform(({ title }) => title),
]);

const courseLevelSchema = z.object({
  chapters: z.array(courseChapterTitleSchema),
  inPlan: z.boolean().default(false),
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

const planNextItemSchema = z.object({
  kind: z.string(),
  plusRequired: plusMarkSchema,
  title: z.string(),
});

const planScopeSnapshotSchema = z.object({
  // Plan questions asked before the plan's context carried its course have none.
  course: courseOutlineSchema.nullable().default(null),
  estimate: z.object({ endDate: z.string().nullable(), remainingHours: z.number() }),
  // Plan questions asked before the buddy read the exam's notice have no exam facts.
  exam: z
    .object({
      days: z.array(z.object({ date: z.string(), label: z.string().nullable() })),
      formats: z.array(z.string()),
      // Snapshots saved before a class test's material was told apart from a notice were notices.
      fromMaterial: z.boolean().default(false),
      name: z.string(),
      official: z.boolean(),
      otherDates: z.array(z.object({ date: z.string(), label: z.string() })).default([]),
      questionCount: z.number().nullable(),
      rules: z.array(z.string()),
      scoring: z.string().nullable(),
      source: z.string().nullable(),
      subjects: z.array(
        z.object({
          group: z.string().nullable(),
          name: z.string(),
          questions: z.number().nullable(),
        }),
      ),
    })
    .nullable()
    .optional(),
  goal: z.object({
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
  scope: z.object({ kind: z.literal("plan") }),
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
          coreMinutes: z.number().nullable().default(null),
          coveredShare: z.number(),
          fits: z.boolean(),
          // Snapshots saved before coverage counted the exam's points measured the goal.
          measure: z.enum(["exam", "goal"]).default("goal"),
          recommendedMinutes: z.number().nullable(),
        })
        .nullable(),
      difficultyBias: z.string(),
      lightWeeks: z.array(z.object({ endDate: z.string(), startDate: z.string() })),
      ownLevel: z.string().nullable(),
      practiceBias: z.string(),
      weekdayMinutes: z.array(z.number()),
    })
    .optional(),
  status: z
    .object({
      days: z.number().nullable(),
      extraMinutesPerDay: z.number().nullable(),
      kind: z.enum(["ahead", "behind", "needsAdjusting", "onTrack"]),
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
          kind: z.string(),
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

const rangeSchema = z.object({ high: z.number(), low: z.number() }).nullable();

const mockScopeSnapshotSchema = z.object({
  areas: z.array(
    z.object({
      correct: z.number(),
      estimate: rangeSchema,
      name: z.string(),
      secondsPerQuestion: z.number(),
      targetSecondsPerQuestion: z.number().nullable(),
      total: z.number(),
    }),
  ),
  exam: z.object({
    date: z.string(),
    fullLength: z.boolean(),
    name: z.string().nullable(),
    number: z.number(),
    scoring: z.string(),
    scoringNote: z.string().nullable(),
  }),
  language: z.string(),
  missed: z.array(
    z.object({
      area: z.string().nullable(),
      correctAnswer: z.string().nullable(),
      explanation: z.string().nullable(),
      learnerAnswer: z.string().nullable(),
      number: z.number(),
      outcome: z.enum(["blank", "wrong"]),
      question: z.string(),
      skill: z.string().nullable(),
    }),
  ),
  mistakeCauses: z.array(z.object({ cause: z.string().nullable(), count: z.number() })),
  result: z
    .object({
      blank: z.number(),
      correct: z.number(),
      estimate: rangeSchema,
      minutesUsed: z.number(),
      plannedMinutes: z.number(),
      total: z.number(),
    })
    .nullable(),
  scope: z.object({ kind: z.literal("mock") }),
  sections: z.array(z.object({ name: z.string().nullable(), questions: z.number() })),
  version: z.literal(1),
});

const lessonQuestionContextSnapshotSchema = z.union([
  lessonScopeSnapshotSchema,
  chapterScopeSnapshotSchema,
  planScopeSnapshotSchema,
  mockScopeSnapshotSchema,
]);

const databaseContextSnapshotSchema = z.record(z.string(), z.json());

export function parseLessonQuestionContextSnapshot(value: unknown): LessonQuestionContextSnapshot {
  return lessonQuestionContextSnapshotSchema.parse(value);
}

export function toDatabaseLessonQuestionContextSnapshot(snapshot: LessonQuestionContextSnapshot) {
  return databaseContextSnapshotSchema.parse(snapshot);
}
