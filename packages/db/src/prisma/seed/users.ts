import { type PrismaClient, type User } from "../../generated/prisma/client";

export type SeedUsers = {
  admin: User;
  logoutTest: User;
  member: User;
  multiOrg: User;
  owner: User;
};

export async function seedUsers(prisma: PrismaClient): Promise<SeedUsers> {
  const owner = await prisma.user.upsert({
    create: {
      email: "owner@zoonk.test",
      emailVerified: true,
      name: "Owner User",
      role: "admin",
      username: "owner_user",
    },
    update: { username: "owner_user" },
    where: { email: "owner@zoonk.test" },
  });

  const admin = await prisma.user.upsert({
    create: {
      email: "admin@zoonk.test",
      emailVerified: true,
      name: "Admin User",
      role: "admin",
      username: "admin_user",
    },
    update: { username: "admin_user" },
    where: { email: "admin@zoonk.test" },
  });

  const member = await prisma.user.upsert({
    create: {
      email: "member@zoonk.test",
      emailVerified: true,
      name: "Member User",
      role: "member",
      username: "member_user",
    },
    update: { username: "member_user" },
    where: { email: "member@zoonk.test" },
  });

  const logoutTest = await prisma.user.upsert({
    create: {
      email: "logout-test@zoonk.test",
      emailVerified: true,
      name: "Logout Test User",
      role: "member",
      username: "logout_test",
    },
    update: { username: "logout_test" },
    where: { email: "logout-test@zoonk.test" },
  });

  const multiOrg = await prisma.user.upsert({
    create: {
      email: "multi-org@zoonk.test",
      emailVerified: true,
      name: "Multi Org User",
      role: "admin",
      username: "multi_org",
    },
    update: { username: "multi_org" },
    where: { email: "multi-org@zoonk.test" },
  });

  return {
    admin,
    logoutTest,
    member,
    multiOrg,
    owner,
  };
}
