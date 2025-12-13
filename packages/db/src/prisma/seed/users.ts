import type { PrismaClient, User } from "../../generated/prisma/client";

export type SeedUsers = {
  admin: User;
  member: User;
  owner: User;
};

export async function seedUsers(prisma: PrismaClient): Promise<SeedUsers> {
  const owner = await prisma.user.upsert({
    create: {
      email: "owner@zoonk.test",
      emailVerified: true,
      name: "Owner User",
      role: "admin",
    },
    update: {},
    where: { email: "owner@zoonk.test" },
  });

  const admin = await prisma.user.upsert({
    create: {
      email: "admin@zoonk.test",
      emailVerified: true,
      name: "Admin User",
      role: "admin",
    },
    update: {},
    where: { email: "admin@zoonk.test" },
  });

  const member = await prisma.user.upsert({
    create: {
      email: "member@zoonk.test",
      emailVerified: true,
      name: "Member User",
      role: "member",
    },
    update: {},
    where: { email: "member@zoonk.test" },
  });

  return { admin, member, owner };
}
