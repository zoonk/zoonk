import { z } from "zod";

const SCORE_DAYPART_COUNT = 4;
const SCORE_WEEKDAY_COUNT = 7;

const logicalDateSchema = z.iso
  .date()
  .meta({
    description: "Learner-local calendar date without a time or UTC offset",
    examples: ["2026-07-27"],
  });

const scorePerformanceSchema = z.object({
  correctAnswers: z.number().int().min(0),
  incorrectAnswers: z.number().int().min(0),
  score: z.number().min(0).max(100),
  totalAnswers: z.number().int().min(0),
});

const learningActivityTotalsSchema = z.object({
  learningDays: z.number().int().min(0),
  totalLearningSeconds: z.number().int().min(0),
  totalLessonCompletions: z.number().int().min(0),
});

const energyLevelSchema = z.object({ currentEnergy: z.number().min(0).max(100) });

const beltSchema = z.enum([
  "white",
  "yellow",
  "orange",
  "green",
  "blue",
  "purple",
  "brown",
  "red",
  "gray",
  "black",
]);

const beltLevelSchema = z.object({
  belt: beltSchema,
  bpPerLevel: z.number().int().min(0),
  bpToNextLevel: z.number().int().min(0),
  isMaxLevel: z.boolean(),
  level: z.number().int().min(1).max(10),
  progressInLevel: z.number().int().min(0),
  totalBrainPower: z.number().int().min(0),
});

const weekdaySchema = z.enum([
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]);

const daypartSchema = z.enum(["night", "morning", "afternoon", "evening"]);

const weekdayScorePatternSchema = scorePerformanceSchema.extend({ dayOfWeek: weekdaySchema });

const timeScorePatternSchema = scorePerformanceSchema.extend({ period: daypartSchema });

const strongestScorePatternsSchema = z.object({
  strongestTime: timeScorePatternSchema.nullable(),
  strongestWeekday: weekdayScorePatternSchema.nullable(),
});

export const currentUserProgressResponseSchema = z
  .object({
    activity: learningActivityTotalsSchema,
    energy: energyLevelSchema.nullable(),
    level: beltLevelSchema.nullable(),
    score: scorePerformanceSchema.nullable(),
    scorePatterns: strongestScorePatternsSchema.nullable(),
  })
  .meta({ id: "CurrentUserProgressResponse" });

export const currentUserActivityResponseSchema = z
  .object({
    activity: learningActivityTotalsSchema.extend({
      days: z.array(
        z.object({ date: logicalDateSchema, lessonCompletions: z.number().int().min(0) }),
      ),
    }),
  })
  .meta({ id: "CurrentUserActivityResponse" });

export const currentUserEnergyResponseSchema = z
  .object({
    energy: z
      .object({
        currentEnergy: z.number().min(0).max(100),
        days: z.array(
          z.object({ date: logicalDateSchema, energy: z.number().min(0).max(100).nullable() }),
        ),
        insights: z
          .object({
            averageEnergy: z.number().min(0).max(100),
            fullEnergyDays: z.number().int().min(0),
          })
          .nullable(),
      })
      .nullable(),
  })
  .meta({ id: "CurrentUserEnergyResponse" });

export const currentUserLevelResponseSchema = z
  .object({ level: beltLevelSchema.nullable() })
  .meta({ id: "CurrentUserLevelResponse" });

export const currentUserScoreResponseSchema = z
  .object({
    score: scorePerformanceSchema
      .extend({
        dataPoints: z.array(scorePerformanceSchema.extend({ date: logicalDateSchema })),
        periodEnd: logicalDateSchema,
        periodStart: logicalDateSchema,
      })
      .nullable(),
  })
  .meta({ id: "CurrentUserScoreResponse" });

export const currentUserScorePatternsResponseSchema = z
  .object({
    patterns: strongestScorePatternsSchema
      .extend({
        times: z.array(timeScorePatternSchema).length(SCORE_DAYPART_COUNT),
        weekdays: z.array(weekdayScorePatternSchema).length(SCORE_WEEKDAY_COUNT),
      })
      .nullable(),
  })
  .meta({ id: "CurrentUserScorePatternsResponse" });

const playerProgressSnapshotSchema = z.object({
  bestDayScores: z
    .array(
      z.object({
        correctAnswers: z.number().int().min(0),
        dayOfWeek: weekdaySchema,
        incorrectAnswers: z.number().int().min(0),
      }),
    )
    .nullable(),
  currentEnergy: z.number().min(0).max(100),
  fullEnergyDays: z.number().int().min(0),
  highestPreviousDailyBrainPower: z.number().int().min(0),
  learningDays: z.number().int().min(0),
  todayBrainPower: z.number().int().min(0),
  todayCompletedLessons: z.number().int().min(0),
  todayEnergyAtEnd: z.number().min(0).max(100).nullable(),
  todayInteractiveLessons: z.number().int().min(0),
  totalLearningSeconds: z.number().int().min(0),
});

export const currentUserProgressSnapshotResponseSchema = z
  .object({
    snapshot: z.object({
      progressSnapshot: playerProgressSnapshotSchema,
      totalBrainPower: z.number().int().min(0),
    }),
  })
  .meta({ id: "CurrentUserProgressSnapshotResponse" });
