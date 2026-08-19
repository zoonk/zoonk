import { z } from "zod";

const APPLE_SIGNED_DATA_MAX_LENGTH = 100_000;

export const appleSubscriptionRequestSchema = z
  .object({ signedTransaction: z.string().min(1).max(APPLE_SIGNED_DATA_MAX_LENGTH) })
  .strict()
  .meta({ id: "AppleSubscriptionRequest" });

export const appleSubscriptionNotificationSchema = z
  .object({ signedPayload: z.string().min(1).max(APPLE_SIGNED_DATA_MAX_LENGTH) })
  .strict()
  .meta({ id: "AppleSubscriptionNotification" });

export type AppleSubscriptionRequest = z.infer<typeof appleSubscriptionRequestSchema>;
export type AppleSubscriptionNotification = z.infer<typeof appleSubscriptionNotificationSchema>;
