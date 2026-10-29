import { z } from "zod";
import { meResponseSchema } from "./me";

export const storeSubscriptionResponseSchema = z
  .object({
    currentAccount: meResponseSchema,
    isActive: z
      .boolean()
      .meta({ description: "Whether the reconciled store subscription currently grants access" }),
  })
  .meta({ id: "StoreSubscriptionResponse" });

const freePlanLimitSchema = z.int().nullable();

export const freePlanResponseSchema = z
  .object({
    activeGoals: freePlanLimitSchema.meta({
      description: "Goals a free account can have at a time",
    }),
    examPrepDays: freePlanLimitSchema.meta({
      description: "Days of an exam plan the free plan includes, or null for all of it",
    }),
    guestLessons: freePlanLimitSchema.meta({
      description: "Lessons a guest can start before creating an account",
    }),
    lessonsPerDay: freePlanLimitSchema.meta({
      description: "Lessons a free account can start each day",
    }),
    lessonsPerMonth: freePlanLimitSchema.meta({
      description: "Lessons a free account can start each month",
    }),
    tutorMessagesPerDay: freePlanLimitSchema.meta({
      description: "Messages a free account can send its study buddy each day",
    }),
    uploadsPerDay: freePlanLimitSchema.meta({
      description: "Files a free account can upload each day",
    }),
  })
  .meta({
    description: "What the free plan includes, for pricing pages. Null means no cap.",
    id: "FreePlan",
  });
