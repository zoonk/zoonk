import { emailAccountDeletionCredentialsSchema } from "@zoonk/auth/email-deletion-contract";
import { nativeAppleCredentialsSchema } from "@zoonk/auth/native-apple-contract";
import { z } from "zod";
import { usernameCandidateSchema } from "./usernames";

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
    username: usernameCandidateSchema
      .optional()
      .meta({ description: "Username shown in profile URLs and mentions" }),
  })
  .strict()
  .refine(hasProfileUpdate, { message: "At least one profile field must be provided" })
  .meta({ id: "MeUpdate", override: { minProperties: 1 } });

export const meDeletionSchema = z
  .xor(
    [
      z.object({}).strict(),
      z.object({ appleCredentials: nativeAppleCredentialsSchema }).strict(),
      z.object({ emailCredentials: emailAccountDeletionCredentialsSchema }).strict(),
    ],
    "Send either Apple credentials or email credentials, not both",
  )
  .meta({ id: "MeDeletion" });

export type MeDeletionInput = z.infer<typeof meDeletionSchema>;

export const meDeletionResponseSchema = z
  .object({
    appleAuthorizationRevoked: z
      .boolean()
      .nullable()
      .meta({ description: "Apple revocation result, or null when no Apple account was linked" }),
  })
  .meta({ id: "MeDeletionResponse" });

const meUserSchema = z
  .object({
    analyticsDisabled: z
      .boolean()
      .meta({ description: "Whether product analytics are disabled for this account" }),
    createdAt: z.iso.datetime().meta({ description: "User creation timestamp" }),
    displayUsername: z.string().nullable().meta({ description: "Display username" }),
    email: z.email().meta({ description: "Email address" }),
    emailVerified: z.boolean().meta({ description: "Whether the email has been verified" }),
    id: z.uuid().meta({ description: "User ID" }),
    image: z.string().nullable().meta({ description: "Profile image URL" }),
    name: z.string().meta({ description: "Display name" }),
    updatedAt: z.iso.datetime().meta({ description: "User update timestamp" }),
    username: z.string().nullable().meta({ description: "Normalized username" }),
  })
  .meta({ id: "MeUser" });

const meSubscriptionSchema = z
  .object({
    cancelAt: z.iso.datetime().nullable().meta({ description: "Scheduled cancellation timestamp" }),
    cancelAtPeriodEnd: z
      .boolean()
      .nullable()
      .meta({ description: "Whether cancellation is scheduled" }),
    id: z.uuid().meta({ description: "Subscription ID" }),
    periodEnd: z.iso.datetime().nullable().meta({ description: "Current billing period end" }),
    periodStart: z.iso.datetime().nullable().meta({ description: "Current billing period start" }),
    plan: z.string().meta({ description: "Subscription plan" }),
    provider: z.string().meta({ description: "Billing provider" }),
    status: z.string().nullable().meta({ description: "Subscription status" }),
  })
  .meta({ id: "MeSubscription" });

export const meResponseSchema = z
  .object({
    account: z
      .object({
        deletion: z
          .object({
            hasAppleAccount: z
              .boolean()
              .meta({ description: "Whether the user has a linked Apple account" }),
          })
          .meta({ description: "Provider state relevant to account deletion" }),
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
