import { randomUUID } from "node:crypto";
import { type Organization, prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

function organizationAttrs(
  attrs?: Partial<Organization>,
): Omit<Organization, "id" | "createdAt" | "updatedAt"> {
  return {
    kind: "brand",
    logo: null,
    metadata: null,
    name: "Test Organization",
    slug: `test-org-${randomUUID()}`,
    stripeCustomerId: null,
    ...attrs,
  };
}

export async function organizationFixture(attrs?: Partial<Organization>) {
  const params = organizationAttrs(attrs);

  const org = await prisma.organization.create({
    data: {
      ...params,
      createdAt: new Date(),
      id: randomUUID(),
    },
  });

  return org;
}

export async function aiOrganizationFixture() {
  try {
    return await prisma.organization.upsert({
      create: {
        id: randomUUID(),
        kind: "brand",
        name: "Zoonk AI",
        slug: AI_ORG_SLUG,
      },
      update: {},
      where: { slug: AI_ORG_SLUG },
    });
  } catch (error) {
    // Handle upsert race condition - another test may have created the org concurrently
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      const existing = await prisma.organization.findUnique({
        where: { slug: AI_ORG_SLUG },
      });

      if (existing) {
        return existing;
      }
    }
    throw error;
  }
}
