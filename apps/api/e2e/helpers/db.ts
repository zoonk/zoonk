import { setTimeout } from "node:timers/promises";
import { prisma } from "@zoonk/db";

const RETRY_DELAY_MS = 500;

/**
 * Needs the emailOTP plugin's `storeOTP: "plain"`. Better Auth stores the identifier as
 * `sign-in-otp-{email}` and the value as `{otp}:{attemptCount}`.
 */
export async function getOTPForEmail(email: string, maxRetries = 10): Promise<string | null> {
  const identifier = `sign-in-otp-${email}`;

  for (let i = 0; i < maxRetries; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- Intentional retry polling
    const verification = await prisma.verification.findFirst({
      orderBy: { createdAt: "desc" },
      where: { identifier },
    });

    if (verification?.value) {
      const otp = verification.value.split(":")[0];

      if (otp) {
        return otp;
      }
    }

    // eslint-disable-next-line no-await-in-loop -- Intentional delay between retries
    await setTimeout(RETRY_DELAY_MS);
  }

  return null;
}

export async function cleanupVerifications(email: string): Promise<void> {
  const identifier = `sign-in-otp-${email}`;
  await prisma.verification.deleteMany({ where: { identifier } });
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
