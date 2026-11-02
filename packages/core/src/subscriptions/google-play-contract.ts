import { z } from "zod";

const PURCHASE_TOKEN_MAX_LENGTH = 4096;
const NOTIFICATION_DATA_MAX_LENGTH = 100_000;
const MESSAGE_ID_MAX_LENGTH = 256;

export const googlePlaySubscriptionRequestSchema = z
  .object({
    purchaseToken: z
      .string()
      .min(1)
      .max(PURCHASE_TOKEN_MAX_LENGTH)
      .meta({ description: "The purchase token Play Billing returned for the subscription" }),
  })
  .strict()
  .meta({ id: "GooglePlaySubscriptionRequest" });

/** Pub/Sub's push envelope; it carries more fields (`publishTime`, snake_case copies) we don't read. */
export const googlePlayNotificationSchema = z
  .object({
    message: z.object({
      data: z
        .string()
        .min(1)
        .max(NOTIFICATION_DATA_MAX_LENGTH)
        .meta({ description: "Base64-encoded Real-time Developer Notification" }),
      messageId: z.string().min(1).max(MESSAGE_ID_MAX_LENGTH),
    }),
  })
  .meta({ id: "GooglePlayNotification" });
