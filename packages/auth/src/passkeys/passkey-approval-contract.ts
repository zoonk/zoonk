import { z } from "zod";

/** WebAuthn caps a credential ID at 1023 bytes, which base64url writes in 1364 characters. */
const MAX_CREDENTIAL_ID_LENGTH = 1364;

/** What the browser's `navigator.credentials.get()` returns, as `@simplewebauthn/browser` sends it. */
export const passkeyAssertionSchema = z
  .object({
    authenticatorAttachment: z.enum(["platform", "cross-platform"]).optional(),
    clientExtensionResults: z.record(z.string(), z.unknown()).default({}),
    id: z.base64url().max(MAX_CREDENTIAL_ID_LENGTH),
    rawId: z.base64url().max(MAX_CREDENTIAL_ID_LENGTH),
    response: z
      .object({
        authenticatorData: z.base64url(),
        clientDataJSON: z.base64url(),
        signature: z.base64url(),
        userHandle: z.base64url().optional(),
      })
      .strict(),
    type: z.literal("public-key"),
  })
  .strict()
  .refine((assertion) => assertion.id === assertion.rawId, { message: "id must match rawId" });

export type PasskeyAssertion = z.infer<typeof passkeyAssertionSchema>;

/** The options the browser passes to `navigator.credentials.get()` to approve one content fix. */
export type PasskeyApprovalOptions = {
  allowCredentials: { id: string; transports?: string[]; type: "public-key" }[];
  challenge: string;
  rpId: string;
  timeout: number;
  userVerification: "required";
};
