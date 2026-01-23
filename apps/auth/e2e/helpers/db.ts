import { setTimeout } from "node:timers/promises";
import { prisma } from "@zoonk/db";

/**
 * Get the latest OTP for an email from the Verification table.
 * Only works when emailOTP plugin is configured with `storeOTP: "plain"`.
 * Retries a few times to handle timing issues.
 *
 * Note: Better Auth stores the identifier as `sign-in-otp-{email}` and
 * the value as `{otp}:{attemptCount}`.
 */
export async function getOTPForEmail(
  email: string,
  maxRetries = 10,
): Promise<string | null> {
  const identifier = `sign-in-otp-${email}`;

  for (let i = 0; i < maxRetries; i++) {
    const verification = await prisma.verification.findFirst({
      orderBy: { createdAt: "desc" },
      where: { identifier },
    });

    if (verification?.value) {
      // Value format is "123456:0" - extract just the OTP code
      const otp = verification.value.split(":")[0];

      if (otp) {
        return otp;
      }
    }

    await setTimeout(500);
  }

  return null;
}

/**
 * Clean up verifications for an email (useful for test cleanup).
 */
export async function cleanupVerifications(email: string): Promise<void> {
  const identifier = `sign-in-otp-${email}`;
  await prisma.verification.deleteMany({
    where: { identifier },
  });
}

/**
 * Disconnect the Prisma client (call after tests).
 */
export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
