import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { UsageKind } from "@zoonk/db";
import { z } from "zod";

const limitSchema = z.int().nullable();

const allowanceItemBaseSchema = z.object({
  dailyLimit: limitSchema.meta({ description: "Hard cap per UTC day, or null" }),
  fairUseDailyLimit: limitSchema.meta({
    description: "Above this many a day, new uses are spaced out instead of blocked",
  }),
  remaining: limitSchema.meta({ description: "Uses left before a hard cap, or null" }),
  totalLimit: limitSchema.meta({ description: "Hard cap for as long as the account exists" }),
  usedToday: z.int().meta({ description: "Uses this UTC day" }),
  usedTotal: z.int().meta({ description: "Uses ever" }),
});

const allowanceItemSchema = z
  .union([
    allowanceItemBaseSchema
      .extend({
        availableAt: z.iso
          .datetime()
          .nullable()
          .meta({
            description:
              "Instant a new lesson becomes available when the rolling cap is reached; null while rolling capacity remains or the tier has no rolling cap. The twentieth-newest claim time plus 30 times 24 hours, including when existing usage exceeds 20",
          }),
        kind: z.literal("lessonStart"),
        rollingLimit: limitSchema.meta({
          description:
            "Hard cap on new lesson claims in the preceding 30 times 24 hours; null for tiers without this cap",
        }),
        usedLast30Days: z
          .int()
          .meta({
            description: "Lesson claims strictly after now minus 30 times 24 hours, through now",
          }),
      })
      .meta({ id: "LessonAllowanceItem" }),
    allowanceItemBaseSchema
      .extend({
        kind: z.enum(UsageKind).exclude(["lessonStart"]),
        monthlyLimit: limitSchema.meta({ description: "Hard cap per UTC calendar month, or null" }),
        usedThisMonth: z.int().meta({ description: "Uses this UTC calendar month" }),
      })
      .meta({ id: "MonthlyAllowanceItem" }),
  ])
  .meta({ id: "AllowanceItem" });

export const allowanceResponseSchema = z
  .object({
    activeGoals: z
      .object({ limit: limitSchema, used: z.int() })
      .meta({ description: "Active goals and the plan's cap, or null for none" }),
    callTime: z
      .object({
        limitSeconds: limitSchema.meta({
          description: "Seconds of live calls the plan allows each UTC day, or null for none",
        }),
        monthLimitSeconds: limitSchema.meta({
          description: "Seconds of live calls the plan allows each UTC month, or null for none",
        }),
        usedSeconds: z
          .int()
          .meta({ description: "Seconds held or used by live calls this UTC day" }),
        usedSecondsThisMonth: z
          .int()
          .meta({ description: "Seconds held or used by live calls this UTC month" }),
      })
      .meta({
        description:
          "Live call time today and this month: each connection holds the call's length, and an ended call keeps what it ran. Don't show learners these amounts; plans only say that Plus has higher call limits",
      }),
    examPrep: z
      .object({
        includesMockExams: z.boolean().meta({ description: "Whether mock exams are included" }),
        studyDays: limitSchema.meta({
          description:
            "Always null. Exam goals use the shared lesson allowance without time-based expiry",
        }),
      })
      .meta({ description: "What exam prep the plan includes" }),
    generatedLessons: z
      .object({ limit: z.int(), used: z.int() })
      .nullable()
      .meta({ description: "A guest's newly generated lessons; null for accounts" }),
    items: z.array(allowanceItemSchema),
    resets: z
      .object({ day: z.iso.datetime(), month: z.iso.datetime() })
      .meta({ description: "When daily and monthly counts start over" }),
    tier: z.enum(["free", "guest", "plus"]).meta({ description: "The learner's plan" }),
  })
  .meta({
    description: `Free learners share ${getFreePlanLimits().lessonsPer30Days} distinct lesson admissions in the preceding 30 times 24 hours across all goals, including exams. The lessonStart entry returns usedLast30Days, rollingLimit, remaining and availableAt. A refused start returns 402 USAGE_LIMIT_REACHED with details.limit period=rolling30Days and availableAt, so no second read or client date arithmetic is needed. Claims exactly 30 days old are outside the window. Replays of an admitted lesson never count again, whatever its age. Generation ahead of study uses the same claim. Other resources retain UTC calendar-month limits and resets.month applies only to them.`,
    id: "AllowanceResponse",
  });
