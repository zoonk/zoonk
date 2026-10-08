import { UsageKind } from "@zoonk/db";
import { z } from "zod";

const limitSchema = z.int().nullable();

const allowanceItemSchema = z
  .object({
    dailyLimit: limitSchema.meta({ description: "Hard cap per UTC day, or null" }),
    fairUseDailyLimit: limitSchema.meta({
      description: "Above this many a day, new uses are spaced out instead of blocked",
    }),
    kind: z.enum(UsageKind).meta({ description: "What is counted" }),
    monthlyLimit: limitSchema.meta({ description: "Hard cap per UTC month, or null" }),
    remaining: limitSchema.meta({ description: "Uses left before a hard cap, or null" }),
    totalLimit: limitSchema.meta({ description: "Hard cap for as long as the account exists" }),
    usedThisMonth: z.int().meta({ description: "Uses this UTC month" }),
    usedToday: z.int().meta({ description: "Uses this UTC day" }),
    usedTotal: z.int().meta({ description: "Uses ever" }),
  })
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
          description: "Days of an exam plan included, or null for all of it",
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
    description:
      "New lessons started count toward the allowance, whether reused or generated. Quick explanations and reviews don't.",
    id: "AllowanceResponse",
  });
