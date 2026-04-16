import { randomUUID } from "node:crypto";
import { type Organization, prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

const SHORT_UUID_LENGTH = 8;

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

/**
 * Create a non-AI organization for e2e scenarios that need cross-org checks.
 * This keeps Playwright setup isolated from Better Auth and from server-only
 * fixtures that depend on Next.js request APIs.
 */
export async function createOrganization(
  attrs?: Partial<Pick<Organization, "kind" | "name" | "slug">>,
) {
  const uniqueId = randomUUID().slice(0, SHORT_UUID_LENGTH);

  return prisma.organization.create({
    data: {
      id: randomUUID(),
      kind: attrs?.kind ?? "brand",
      name: attrs?.name ?? `E2E Organization ${uniqueId}`,
      slug: attrs?.slug ?? `e2e-org-${uniqueId}`,
    },
  });
}
