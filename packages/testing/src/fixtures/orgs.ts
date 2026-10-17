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
    data: { ...params, createdAt: new Date(), id: randomUUID() },
  });

  return org;
}

export async function aiOrganizationFixture() {
  // One statement that waits for another writer of the organization instead of failing on it.
  await prisma.organization.createMany({
    data: [{ id: randomUUID(), kind: "brand", name: "Zoonk AI", slug: AI_ORG_SLUG }],
    skipDuplicates: true,
  });

  return prisma.organization.findUniqueOrThrow({ where: { slug: AI_ORG_SLUG } });
}
