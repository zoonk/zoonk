import { mkdir } from "node:fs/promises";
import { prisma } from "@zoonk/db";
import { resetGuestSpend } from "@zoonk/testing/fixtures/usage";

/** Clears the AI budget guests share, which every run's test guests would spend. */
export default async function globalSetup(): Promise<void> {
  await Promise.all([mkdir("e2e/.auth", { recursive: true }), resetGuestSpend()]);
  await prisma.$disconnect();
}
