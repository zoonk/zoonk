import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
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
    guestLessons: freePlanLimitSchema.meta({
      description: "Lessons a guest can start before creating an account",
    }),
    lessonsPer30Days: freePlanLimitSchema.meta({
      description: `${getFreePlanLimits().lessonsPer30Days} distinct lessons across all goals in the preceding 30 times 24 hours; admitted lessons can be replayed without another charge`,
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
    periodEnd: z.iso
      .datetime()
      .nullable()
      .meta({
        description:
          "When renewing Plus would end if canceled, or when ending Plus ends. Null for an unpaid renewal.",
      }),
    state: z
      .enum(["renewing", "ending", "unpaid"])
      .meta({
        description: "Saved website billing state. Unpaid renewals end immediately when canceled.",
      }),
  })
  .meta({ id: "StripeSubscriptionCancellation" });

export const stripeSubscriptionCancellationReceiptSchema = z
  .object({ endsAt: z.iso.datetime() })
  .meta({ id: "StripeSubscriptionCancellationReceipt" });
