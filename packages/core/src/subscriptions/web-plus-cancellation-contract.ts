import { z } from "zod";

const REASON_MAX_LENGTH = 1000;

export const webPlusCancellationRequestSchema = z
  .object({
    choice: z
      .enum(["ordinary", "withdrawal", "extraordinary"])
      .meta({
        description:
          "ordinary stops the renewal; withdrawal ends Plus now with the 14-day full refund; extraordinary ends Plus now for an important reason and refunds the full days left",
      }),
    reason: z
      .string()
      .trim()
      .min(1)
      .max(REASON_MAX_LENGTH)
      .optional()
      .meta({ description: "Why, for an extraordinary cancellation, which needs one" }),
  })
  .strict()
  .refine((request) => request.choice !== "extraordinary" || request.reason !== undefined, {
    message: "An extraordinary cancellation needs a reason",
    path: ["reason"],
  })
  .meta({ id: "StripeSubscriptionCancellationRequest" });

export type WebPlusCancellationRequest = z.infer<typeof webPlusCancellationRequestSchema>;
export type WebPlusCancellationChoice = WebPlusCancellationRequest["choice"];
