import { type PrismaClient, type User } from "../../generated/prisma/client";

export type SeedUsers = {
  admin: User;
  logoutTest: User;
  member: User;
  multiOrg: User;
  owner: User;
};

export const SEED_USER_EMAILS = {
  admin: "admin@zoonk.test",
  logoutTest: "logout-test@zoonk.test",
  member: "member@zoonk.test",
  multiOrg: "multi-org@zoonk.test",
  owner: "owner@zoonk.test",
} as const satisfies Record<keyof SeedUsers, string>;

export async function seedUsers(prisma: PrismaClient): Promise<SeedUsers> {
  const owner = await prisma.user.upsert({
    create: {
      email: SEED_USER_EMAILS.owner,
      emailVerified: true,
      name: "Owner User",
      role: "admin",
      username: "owner_user",
    },
    update: { username: "owner_user" },
    where: { email: SEED_USER_EMAILS.owner },
  });

  const admin = await prisma.user.upsert({
    create: {
      email: SEED_USER_EMAILS.admin,
      emailVerified: true,
      name: "Admin User",
      role: "admin",
      username: "admin_user",
    },
    update: { username: "admin_user" },
    where: { email: SEED_USER_EMAILS.admin },
  });

  const member = await prisma.user.upsert({
    create: {
      email: SEED_USER_EMAILS.member,
      emailVerified: true,
      name: "Member User",
      role: "member",
      username: "member_user",
    },
    update: { username: "member_user" },
    where: { email: SEED_USER_EMAILS.member },
  });

  const logoutTest = await prisma.user.upsert({
    create: {
      email: SEED_USER_EMAILS.logoutTest,
      emailVerified: true,
      name: "Logout Test User",
      role: "member",
      username: "logout_test",
    },
    update: { username: "logout_test" },
    where: { email: SEED_USER_EMAILS.logoutTest },
  });

  const multiOrg = await prisma.user.upsert({
    create: {
      email: SEED_USER_EMAILS.multiOrg,
      emailVerified: true,
      name: "Multi Org User",
      role: "admin",
      username: "multi_org",
    },
    update: { username: "multi_org" },
    where: { email: SEED_USER_EMAILS.multiOrg },
  });

  return { admin, logoutTest, member, multiOrg, owner };
}
