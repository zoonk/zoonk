import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type Organization, type PrismaClient } from "../../generated/prisma/client";
import { type SeedUsers } from "./users";

export type SeedOrganizations = {
  ai: Organization;
  testOrg: Organization;
};

export async function seedOrganizations(
  prisma: PrismaClient,
  users: SeedUsers,
): Promise<SeedOrganizations> {
  const [ai, testOrg] = await Promise.all([
    prisma.organization.upsert({
      create: {
        members: {
          create: [
            { role: "owner", userId: users.owner.id },
            { role: "admin", userId: users.admin.id },
            { role: "member", userId: users.member.id },
            { role: "admin", userId: users.multiOrg.id },
          ],
        },
        name: "Zoonk AI",
        slug: AI_ORG_SLUG,
      },
      update: {},
      where: { slug: AI_ORG_SLUG },
    }),
    prisma.organization.upsert({
      create: {
        members: {
          create: [{ role: "owner", userId: users.multiOrg.id }],
        },
        name: "Test Org",
        slug: "test-org",
      },
      update: {},
      where: { slug: "test-org" },
    }),
  ]);

  return { ai, testOrg };
}
