import type { Organization, PrismaClient } from "../../generated/prisma/client";
import type { SeedUsers } from "./users";

export async function seedOrganizations(
  prisma: PrismaClient,
  users: SeedUsers,
): Promise<Organization> {
  const org = await prisma.organization.upsert({
    create: {
      members: {
        create: [
          { role: "owner", userId: users.owner.id },
          { role: "admin", userId: users.admin.id },
          { role: "member", userId: users.member.id },
        ],
      },
      name: "Zoonk AI",
      slug: "ai",
    },
    update: {},
    where: { slug: "ai" },
  });

  return org;
}
