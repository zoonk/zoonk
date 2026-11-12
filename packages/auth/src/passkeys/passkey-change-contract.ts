import { z } from "zod";
import { passkeyAssertionSchema } from "./passkey-approval-contract";

/** Better Auth's ids are text; this only keeps an absurd one out of a stored identifier. */
const MAX_PASSKEY_ID_LENGTH = 64;

/** A change to an account's passkeys that one of its existing passkeys has to confirm. */
export const passkeyChangeSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("add") }),
  z.strictObject({
    action: z.literal("delete"),
    passkeyId: z.string().min(1).max(MAX_PASSKEY_ID_LENGTH),
  }),
]);

export type PasskeyChange = z.infer<typeof passkeyChangeSchema>;

export const passkeyChangeApprovalSchema = z.strictObject({
  assertion: passkeyAssertionSchema,
  change: passkeyChangeSchema,
});

export const PASSKEY_CHANGE_ERROR_CODES = {
  confirmationInvalid: "PASSKEY_CONFIRMATION_INVALID",
  confirmationRequired: "PASSKEY_CONFIRMATION_REQUIRED",
} as const;
