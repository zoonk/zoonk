import {
  restoreKeyRequestSchema,
  restoreKeySessionRequestSchema,
} from "@zoonk/auth/restore-key-contract";
import { z } from "zod";

const EMAIL_CODE_PATTERN = /^\d{6}$/u;

export const emailSignInCodeRequestSchema = z
  .object({ email: z.email() })
  .strict()
  .meta({ id: "EmailSignInCodeRequest" });

export const emailCodeSessionRequestSchema = z
  .object({ code: z.string().regex(EMAIL_CODE_PATTERN), email: z.email() })
  .strict()
  .meta({ id: "EmailCodeSessionRequest" });

export const googleSessionRequestSchema = z
  .object({ idToken: z.string().min(1) })
  .strict()
  .meta({ id: "GoogleSessionRequest" });

export const sessionTokenResponseSchema = z
  .object({ token: z.string().min(1) })
  .meta({ id: "SessionTokenResponse" });

export const restoreKeyRequestBodySchema = restoreKeyRequestSchema
  .extend({
    registrationResponseJson: restoreKeyRequestSchema.shape.registrationResponseJson.meta({
      description:
        "The `registrationResponseJson` of Credential Manager's `CreateRestoreCredentialResponse`, unchanged",
    }),
  })
  .meta({ id: "RestoreKeyRequest" });

export const restoreKeySessionRequestBodySchema = restoreKeySessionRequestSchema
  .extend({
    authenticationResponseJson:
      restoreKeySessionRequestSchema.shape.authenticationResponseJson.meta({
        description: "`RestoreCredential.authenticationResponseJson`, unchanged",
      }),
  })
  .meta({ id: "RestoreKeySessionRequest" });

export const restoreKeySessionResponseSchema = z
  .object({
    isGuest: z.boolean().meta({ description: "Whether the restored learner is a guest" }),
    token: z.string().min(1),
  })
  .meta({ id: "RestoreKeySessionResponse" });
