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
  nextBelt: z
    .object({
      belt: beltSchema,
      brainPowerToGo: z.number().int().min(1),
      startBrainPower: z.number().int().min(0),
    })
    .nullable()
    .meta({
      description:
        "The belt after the learner's current one, the total Brain Power where it starts and how much more that takes; null on Black, the last belt",
    }),
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
        z.object({
          activitiesCompleted: z
            .number()
            .int()
            .min(0)
            .meta({
              description:
                "Lessons, reviews and practice finished that day; above zero exactly on a learning day",
            }),
          date: logicalDateSchema,
          lessonCompletions: z
            .number()
            .int()
            .min(0)
            .meta({ description: "Lessons finished for the first time that day" }),
        }),
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

const scorePatternVerdictSchema = z
  .object({
    kind: z
      .enum(["best", "even", "notEnough"])
      .meta({
        description:
          "best: the strongest group (strongestWeekday for dayVerdict, strongestTime for timeVerdict) stands out from the others that count; even: the groups that count score a few points apart, so any of them works; notEnough: fewer than two groups count",
      }),
    points: z
      .number()
      .int()
      .min(0)
      .nullable()
      .meta({
        description: "For even, how many points apart they score, rounded up; null otherwise",
      }),
  })
  .meta({ id: "ScorePatternVerdict" });

export const currentUserScorePatternsResponseSchema = z
  .object({
    patterns: strongestScorePatternsSchema
      .extend({
        dayVerdict: scorePatternVerdictSchema,
        minimumAnswers: z
          .number()
          .int()
          .min(1)
          .meta({
            description:
              "Answers a day or a time of day needs to count, so one lucky answer never makes a pattern; one with fewer shows but doesn't count",
          }),
        timeVerdict: scorePatternVerdictSchema,
        times: z.array(timeScorePatternSchema).length(SCORE_DAYPART_COUNT),
        weekSpread: z
          .object({ high: z.number().min(0).max(100), low: z.number().min(0).max(100) })
          .nullable()
          .meta({
            description:
              "The lowest and highest score of the days that count; null while fewer than two count",
          }),
        weekdays: z.array(weekdayScorePatternSchema).length(SCORE_WEEKDAY_COUNT),
      })
      .nullable(),
  })
  .meta({ id: "CurrentUserScorePatternsResponse" });
