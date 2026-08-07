import { z } from "zod";

/** Identifies a valid email OTP that authenticated a different Zoonk user. */
export class EmailAccountDeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailAccountDeletionError";
  }
}

export const emailAccountDeletionCredentialsSchema = z
  .object({
    email: z.email().meta({ description: "Email address receiving the reauthentication code" }),
    otp: z.string().trim().min(1).meta({ description: "Single-use email reauthentication code" }),
  })
  .strict()
  .meta({ id: "EmailAccountDeletionCredentials" });

export type EmailAccountDeletionCredentials = z.infer<typeof emailAccountDeletionCredentialsSchema>;
