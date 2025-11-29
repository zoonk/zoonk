import { prisma } from "@zoonk/db";
import type { Organization } from "@zoonk/db/models";

export function organizationAttrs(
  attrs?: Partial<Organization>,
): Omit<Organization, "id" | "createdAt" | "updatedAt"> {
  const timestamp = Date.now();

  return {
    kind: "brand",
    logo: null,
    metadata: null,
    name: "Test Organization",
    slug: `test-org-${timestamp}`,
    ...attrs,
  };
}

export async function organizationFixture(attrs?: Partial<Organization>) {
  const params = organizationAttrs(attrs);

  const org = await prisma.organization.create({
    data: {
      ...params,
      createdAt: new Date(),
    },
  });

  return org;
}
