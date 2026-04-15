import { randomUUID } from "node:crypto";
import { type Member, type Organization, prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { userFixture } from "./users";

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
    },
  });

  return org;
}

/**
 * Create a member when a test needs both a user and an organization.
 * Many permission tests operate at the membership level, so this fixture keeps
 * user, organization, and member creation in one place instead of repeating the
 * same setup in every test.
 */
export async function memberFixture(
  attrs?: {
    orgKind?: Organization["kind"];
  } & Partial<Member>,
) {
  const { orgKind, ...memberAttrs } = attrs || {};
  const [user, org] = await Promise.all([userFixture(), organizationFixture({ kind: orgKind })]);

  const member = await prisma.member.create({
    data: {
      createdAt: new Date(),
      organizationId: memberAttrs?.organizationId || org.id,
      role: memberAttrs?.role || "member",
      userId: memberAttrs?.userId || user.id,
      ...memberAttrs,
    },
  });

  return { member, organization: org, user };
}

export async function aiOrganizationFixture() {
  try {
    return await prisma.organization.upsert({
      create: {
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
