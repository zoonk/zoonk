import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { UsageKind } from "@zoonk/db";
import { z } from "zod";

const limitSchema = z.int().nullable();

const allowanceItemBaseSchema = z.object({
  dailyLimit: limitSchema.meta({ description: "Hard cap per UTC day, or null" }),
  fairUseDailyLimit: limitSchema.meta({
    description: "Above this many a day, new uses are spaced out instead of blocked",
  }),
  remaining: limitSchema.meta({
    description: "Uses left before a hard cap, or null; conversation amounts are seconds",
  }),
  totalLimit: limitSchema.meta({ description: "Hard cap for as long as the account exists" }),
  usedToday: z
    .int()
    .meta({ description: "Uses this UTC day; seconds for conversation, claims otherwise" }),
  usedTotal: z.int().meta({ description: "Claims ever, including conversation starts" }),
});

const allowanceItemSchema = allowanceItemBaseSchema
  .extend({
    availableAt: z.iso
      .datetime()
      .nullable()
      .meta({
        description:
          "Earliest instant another use is admitted against this item's recorded caps, assuming no intervening use. Null below all rolling caps or when waiting alone cannot admit a use. Calls require positive seconds and positive call money capacity and then run whole. Includes a currently blocking UTC-day reset.",
      }),
    kind: z.enum(UsageKind),
    rollingLimit: limitSchema.meta({
      description:
        "Cap in the preceding 30 times 24 hours; conversation amounts are seconds, other kinds count claims. Null when uncapped.",
    }),
    usedLast30Days: z
      .int()
      .meta({
        description:
          "Usage newer than now minus 30 times 24 hours; seconds for conversation and counted claims otherwise. Lesson starts use their counted instant; automatic preparation is excluded until started.",
      }),
  })
  .meta({ id: "AllowanceItem" });

export const allowanceResponseSchema = z
  .object({
    activeGoals: z
      .object({ limit: limitSchema, used: z.int() })
      .meta({ description: "Active goals and the plan's cap, or null for none" }),
    examPrep: z
      .object({
        includesMockExams: z.boolean().meta({ description: "Whether mock exams are included" }),
      })
      .meta({ description: "What exam prep the plan includes" }),
    generatedLessons: z
      .object({ limit: z.int(), used: z.int() })
      .nullable()
      .meta({ description: "A guest's newly generated lessons; null for accounts" }),
    items: z.array(allowanceItemSchema),
    resets: z
      .object({ day: z.iso.datetime() })
      .meta({ description: "When the UTC daily counts start over" }),
    tier: z.enum(["free", "guest", "plus"]).meta({ description: "The learner's plan" }),
  })
  .meta({
    description: `Free learners share ${getFreePlanLimits().lessonsPer30Days} distinct counted lesson starts in a rolling 30 times 24 hours across all goals, including exams. The lessonStart entry returns usedLast30Days, rollingLimit, remaining and availableAt. A refused start returns 402 USAGE_LIMIT_REACHED with details.limit period=rolling30Days and availableAt, so no second read or client date arithmetic is needed. Claims exactly 30 days old are outside the window. Replays of a counted lesson never count again, whatever its age. Automatic preparation is bounded separately by counted starts plus unstarted preparations, and counts toward the learner allowance only when first started. A map explicitly requested by the learner counts each lesson it writes first at map admission. A map bundle uses resource=chapterLessons and returns the instant all its new lessons fit; more than 20 new lessons uses period=total and availableAt=null rather than claiming used lessons. Internal automatic-preparation refusals use resource=lessonPreparation. Every monthly cap uses the same rolling window. Nothing resets on the first of a calendar month. Each item returns rollingLimit, usedLast30Days and availableAt. Conversation amounts are seconds.`,
    id: "AllowanceResponse",
  });
