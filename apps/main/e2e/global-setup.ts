import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";

export default async function globalSetup(): Promise<void> {
  await getAiOrganization();
  await prisma.$disconnect();
}
