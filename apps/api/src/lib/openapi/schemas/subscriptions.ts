import { z } from "zod";
import { meResponseSchema } from "./me";

export const appleSubscriptionResponseSchema = z
  .object({
    currentAccount: meResponseSchema,
    isActive: z
      .boolean()
      .meta({
        description: "Whether the reconciled App Store subscription currently grants access",
      }),
  })
  .meta({ id: "AppleSubscriptionResponse" });
