import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

/**
 * Fetch the shared AI organization without importing auth-bound fixtures.
 * Browser tests run outside the Next.js server runtime, so they need a Prisma-
 * only path for the organization that gates AI generation flows.
 */
export async function getAiOrganization() {
  return prisma.organization.upsert({
    create: { id: randomUUID(), kind: "brand", name: "Zoonk AI", slug: AI_ORG_SLUG },
    update: {},
    where: { slug: AI_ORG_SLUG },
  });
}
