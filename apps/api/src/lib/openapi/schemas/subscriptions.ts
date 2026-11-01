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

export const stripeSubscriptionCancellationSchema = z
  .object({
    canResumeRenewal: z
      .boolean()
      .meta({ description: "The renewal is stopped, so DELETE turns it back on (Keep Plus)" }),
    cancellation: z
      .object({ endsAt: z.iso.datetime() })
      .nullable()
      .meta({
        description:
          "Plus ends with its paid period, or immediately for an unpaid renewal. Null when the renewal is already stopped",
      }),
    unpaid: z
      .boolean()
      .meta({
        description:
          "The renewal payment failed, so cancellation ends Plus immediately and stops charge retries",
      }),
  })
  .meta({ id: "StripeSubscriptionCancellation" });

export const stripeSubscriptionCancellationReceiptSchema = z
  .object({ endsAt: z.iso.datetime(), receivedAt: z.iso.datetime() })
  .meta({ id: "StripeSubscriptionCancellationReceipt" });
