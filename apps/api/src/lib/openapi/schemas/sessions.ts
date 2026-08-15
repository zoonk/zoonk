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
