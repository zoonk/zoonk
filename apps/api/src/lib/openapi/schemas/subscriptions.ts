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

const moneySchema = z
  .object({
    amount: z.number().meta({ description: "In the currency's major unit: 29.9 is R$ 29,90" }),
    currency: z.string().meta({ description: "ISO 4217 code, such as BRL" }),
  })
  .meta({ id: "Money" });

export const stripeSubscriptionCancellationSchema = z
  .object({
    cancellation: z
      .object({
        endsAt: z.iso.datetime(),
        refund: moneySchema
          .nullable()
          .meta({ description: "After a yearly renewal, the months that haven't started" }),
      })
      .nullable()
      .meta({
        description:
          "Stopping the renewal, so Plus ends at endsAt. Null when the renewal is already stopped",
      }),
    extraordinary: z
      .object({
        refund: moneySchema
          .nullable()
          .meta({ description: "The full days left until Plus would end" }),
      })
      .nullable()
      .meta({
        description:
          "Ending Plus now for an important reason, which the request names. Null for an unpaid renewal, whose cancellation already ends it now",
      }),
    withdrawal: z
      .object({
        refund: moneySchema,
        until: z.iso.datetime().meta({ description: "The last day of the 14-day refund" }),
      })
      .nullable()
      .meta({
        description:
          "Within 14 days of subscribing: Plus ends now and the whole payment is refunded",
      }),
  })
  .meta({ id: "StripeSubscriptionCancellation" });

export const stripeSubscriptionCancellationReceiptSchema = z
  .object({
    endsAt: z.iso.datetime(),
    receivedAt: z.iso.datetime(),
    refund: moneySchema.nullable(),
  })
  .meta({
    description: "The learner also gets this receipt by email",
    id: "StripeSubscriptionCancellationReceipt",
  });
