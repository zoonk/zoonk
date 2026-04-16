import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";

export default async function globalSetup(): Promise<void> {
  await getAiOrganization();

  await prisma.organization.upsert({
    create: { id: randomUUID(), kind: "brand", name: "Test Org", slug: "test-org" },
    update: {},
    where: { slug: "test-org" },
  });

  await prisma.$disconnect();
}
