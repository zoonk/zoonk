import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/helpers";

export default async function globalSetup(): Promise<void> {
  await getAiOrganization();

  await prisma.organization.upsert({
    create: { kind: "brand", name: "Test Org", slug: "test-org" },
    update: {},
    where: { slug: "test-org" },
  });

  await prisma.$disconnect();
}
