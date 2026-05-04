import { z } from "zod";

/**
 * Requires PATCH callers to send at least one profile field while still letting
 * each field remain optional for partial updates.
 */
function hasProfileUpdate(data: { name?: string; username?: string }) {
  return data.name !== undefined || data.username !== undefined;
}

export const meUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional().meta({ description: "Display name" }),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .optional()
      .meta({ description: "Username shown in profile URLs and mentions" }),
  })
  .refine(hasProfileUpdate, { message: "At least one profile field must be provided" })
  .meta({ id: "MeUpdate" });

const meUserSchema = z
  .object({
    createdAt: z.string().meta({ description: "User creation timestamp" }),
    displayUsername: z.string().nullable().meta({ description: "Display username" }),
    email: z.email().meta({ description: "Email address" }),
    emailVerified: z.boolean().meta({ description: "Whether the email has been verified" }),
    id: z.string().meta({ description: "User ID" }),
    image: z.string().nullable().meta({ description: "Profile image URL" }),
    name: z.string().meta({ description: "Display name" }),
    updatedAt: z.string().meta({ description: "User update timestamp" }),
    username: z.string().nullable().meta({ description: "Normalized username" }),
  })
  .meta({ id: "MeUser" });

const meSubscriptionSchema = z
  .object({
    cancelAtPeriodEnd: z
      .boolean()
      .nullable()
      .meta({ description: "Whether cancellation is scheduled" }),
    id: z.string().meta({ description: "Subscription ID" }),
    periodEnd: z.string().nullable().meta({ description: "Current billing period end" }),
    periodStart: z.string().nullable().meta({ description: "Current billing period start" }),
    plan: z.string().meta({ description: "Subscription plan" }),
    provider: z.string().meta({ description: "Billing provider" }),
    status: z.string().nullable().meta({ description: "Subscription status" }),
  })
  .meta({ id: "MeSubscription" });

export const meResponseSchema = z
  .object({
    account: z
      .object({
        hasActiveSubscription: z
          .boolean()
          .meta({ description: "Whether the account has an active or trialing subscription" }),
        subscription: meSubscriptionSchema
          .nullable()
          .meta({ description: "Active subscription details, when present" }),
      })
      .meta({ description: "Account state for the current user" }),
    user: meUserSchema,
  })
  .meta({ id: "MeResponse" });
