import { prisma } from "@zoonk/db";
import type { Member, Organization } from "@zoonk/db/models";
import { userFixture } from "./users";

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

export async function memberFixture(attrs?: Partial<Member>) {
  const [user, org] = await Promise.all([userFixture(), organizationFixture()]);

  const member = await prisma.member.create({
    data: {
      createdAt: new Date(),
      organizationId: attrs?.organizationId || org.id,
      role: attrs?.role || "member",
      userId: attrs?.userId || Number(user.id),
      ...attrs,
    },
  });

  return { member, organization: org, user };
}
