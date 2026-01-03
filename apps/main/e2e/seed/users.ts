import type { PrismaClient, User } from "@zoonk/db";

export const E2E_USERS = {
  logout: {
    email: "e2e-logout@zoonk.test",
    password: "password123",
  },
  noProgress: {
    email: "e2e-new@zoonk.test",
    password: "password123",
  },
  withProgress: {
    email: "e2e-progress@zoonk.test",
    password: "password123",
  },
} as const;

export type E2EUserKey = keyof typeof E2E_USERS;

export type E2EUsers = {
  logout: User;
  noProgress: User;
  withProgress: User;
};

export async function seedUsers(prisma: PrismaClient): Promise<E2EUsers> {
  const withProgress = await prisma.user.upsert({
    create: {
      email: E2E_USERS.withProgress.email,
      emailVerified: true,
      name: "E2E Progress User",
      role: "member",
    },
    update: {},
    where: { email: E2E_USERS.withProgress.email },
  });

  const noProgress = await prisma.user.upsert({
    create: {
      email: E2E_USERS.noProgress.email,
      emailVerified: true,
      name: "E2E New User",
      role: "member",
    },
    update: {},
    where: { email: E2E_USERS.noProgress.email },
  });

  const logout = await prisma.user.upsert({
    create: {
      email: E2E_USERS.logout.email,
      emailVerified: true,
      name: "E2E Logout User",
      role: "member",
    },
    update: {},
    where: { email: E2E_USERS.logout.email },
  });

  return { logout, noProgress, withProgress };
}

export async function seedAccounts(
  prisma: PrismaClient,
  users: E2EUsers,
): Promise<void> {
  const accountData = Object.entries(users).map(([key, user]) => ({
    accountId: user.email,
    password: E2E_USERS[key as E2EUserKey].password,
    providerId: "credential",
    userId: user.id,
  }));

  await prisma.account.createMany({
    data: accountData,
    skipDuplicates: true,
  });
}
