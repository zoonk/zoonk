import { z } from "zod";

export const nativeAppleCredentialsSchema = z
  .object({
    authorizationCode: z.string().min(1),
    client: z
      .enum(["app", "web"])
      .default("app")
      .meta({
        description:
          "Which Apple client issued the credentials: `app` for the iOS app's native sign-in, `web` for Apple's authorize page opened with Zoonk's Services ID, as the Android app does",
      }),
    idToken: z.string().min(1),
    nonce: z
      .string()
      .min(1)
      .meta({
        description:
          "The raw nonce the client made. Apple's identity token carries its SHA-256, in hex, as the `nonce` claim",
      }),
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

export type NativeAppleClient = NativeAppleCredentials["client"];
