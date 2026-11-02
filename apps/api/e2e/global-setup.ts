import { prisma } from "@zoonk/db";
import { clearLeftOpenLiveCalls, resetGuestSpend } from "@zoonk/testing/fixtures/usage";

/** Every run's test guests spend the AI budget guests share. */
export default async function globalSetup(): Promise<void> {
  await Promise.all([resetGuestSpend(), clearLeftOpenLiveCalls()]);

  await prisma.$disconnect();
}
