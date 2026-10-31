import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

/** Playwright runs outside the Next.js server, so this can't use the auth-bound fixtures. */
export async function getAiOrganization() {
  return prisma.organization.upsert({
    create: { id: randomUUID(), kind: "brand", name: "Zoonk AI", slug: AI_ORG_SLUG },
    update: {},
    where: { slug: AI_ORG_SLUG },
  });
}
