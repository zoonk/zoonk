import { z } from "zod";

export const nativeAppleCredentialsSchema = z
  .object({
    authorizationCode: z.string().min(1),
    idToken: z.string().min(1),
    nonce: z.string().min(1),
    user: z
      .object({
        email: z.email().optional(),
        name: z
          .object({ firstName: z.string().optional(), lastName: z.string().optional() })
          .optional(),
      })
      .optional(),
  })
  .strict()
  .meta({ id: "AppleSessionRequest" });

export type NativeAppleCredentials = z.infer<typeof nativeAppleCredentialsSchema>;
