import { z } from "zod";

export class AccountDeletionEmailMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountDeletionEmailMismatchError";
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
