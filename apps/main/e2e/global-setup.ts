import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/helpers";

export default async function globalSetup(): Promise<void> {
  await getAiOrganization();
  await prisma.$disconnect();
}
