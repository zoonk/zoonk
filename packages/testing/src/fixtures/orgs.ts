import { randomUUID } from "node:crypto";
import { type Member, type Organization, prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { userFixture } from "./users";

export function organizationAttrs(
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
    },
  });

  return org;
}

export async function memberFixture(
  attrs?: {
    orgKind?: Organization["kind"];
  } & Partial<Member>,
) {
  const { orgKind, ...memberAttrs } = attrs ?? {};
  const [user, org] = await Promise.all([userFixture(), organizationFixture({ kind: orgKind })]);

  const member = await prisma.member.create({
    data: {
      createdAt: new Date(),
      organizationId: memberAttrs?.organizationId ?? org.id,
      role: memberAttrs?.role ?? "member",
      userId: memberAttrs?.userId ?? Number(user.id),
      ...memberAttrs,
    },
  });

  return { member, organization: org, user };
}

export async function aiOrganizationFixture() {
  return prisma.organization.upsert({
    create: {
      kind: "brand",
      name: "Zoonk AI",
      slug: AI_ORG_SLUG,
    },
    update: {},
    where: { slug: AI_ORG_SLUG },
  });
}
