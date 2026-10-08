import { mkdir } from "node:fs/promises";
import { prisma } from "@zoonk/db";
import { resetNewcomerSpend } from "@zoonk/testing/fixtures/usage";

/** Clears the AI budget newcomers share, which every run's young test accounts would spend. */
export default async function globalSetup(): Promise<void> {
  await Promise.all([mkdir("e2e/.auth", { recursive: true }), resetNewcomerSpend()]);
  await prisma.$disconnect();
}
