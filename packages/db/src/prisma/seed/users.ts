import { type PrismaClient, type User } from "../../generated/prisma/client";

export type SeedUsers = {
  admin: User;
  e2eLogout: User;
  e2eNoProgress: User;
  e2eWithProgress: User;
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
      username: "owner-user",
    },
    update: { username: "owner-user" },
    where: { email: "owner@zoonk.test" },
  });

  const admin = await prisma.user.upsert({
    create: {
      email: "admin@zoonk.test",
      emailVerified: true,
      name: "Admin User",
      role: "admin",
      username: "admin-user",
    },
    update: { username: "admin-user" },
    where: { email: "admin@zoonk.test" },
  });

  const member = await prisma.user.upsert({
    create: {
      email: "member@zoonk.test",
      emailVerified: true,
      name: "Member User",
      role: "member",
      username: "member-user",
    },
    update: { username: "member-user" },
    where: { email: "member@zoonk.test" },
  });

  // Dedicated user for logout tests to avoid session interference with parallel tests
  const logoutTest = await prisma.user.upsert({
    create: {
      email: "logout-test@zoonk.test",
      emailVerified: true,
      name: "Logout Test User",
      role: "member",
      username: "logout-test",
    },
    update: { username: "logout-test" },
    where: { email: "logout-test@zoonk.test" },
  });

  // E2E test users with well-known credentials for auth testing
  const e2eWithProgress = await prisma.user.upsert({
    create: {
      email: "e2e-progress@zoonk.test",
      emailVerified: true,
      name: "E2E Progress User",
      role: "member",
      username: "e2e-progress",
    },
    update: { username: "e2e-progress" },
    where: { email: "e2e-progress@zoonk.test" },
  });

  const e2eNoProgress = await prisma.user.upsert({
    create: {
      email: "e2e-new@zoonk.test",
      emailVerified: true,
      name: "E2E New User",
      role: "member",
      username: "e2e-new",
    },
    update: { username: "e2e-new" },
    where: { email: "e2e-new@zoonk.test" },
  });

  const e2eLogout = await prisma.user.upsert({
    create: {
      email: "e2e-logout@zoonk.test",
      emailVerified: true,
      name: "E2E Logout User",
      role: "member",
      username: "e2e-logout",
    },
    update: { username: "e2e-logout" },
    where: { email: "e2e-logout@zoonk.test" },
  });

  // E2E test user with access to multiple organizations
  const multiOrg = await prisma.user.upsert({
    create: {
      email: "multi-org@zoonk.test",
      emailVerified: true,
      name: "Multi Org User",
      role: "admin",
      username: "multi-org",
    },
    update: { username: "multi-org" },
    where: { email: "multi-org@zoonk.test" },
  });

  return {
    admin,
    e2eLogout,
    e2eNoProgress,
    e2eWithProgress,
    logoutTest,
    member,
    multiOrg,
    owner,
  };
}
