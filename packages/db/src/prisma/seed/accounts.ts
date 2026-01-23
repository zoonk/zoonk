import type { PrismaClient } from "../../generated/prisma/client";
import type { SeedUsers } from "./users";

const TEST_PASSWORD = "password123";

export async function seedAccounts(prisma: PrismaClient, users: SeedUsers): Promise<void> {
  const accountData = Object.values(users).map((user) => ({
    accountId: user.email,
    password: TEST_PASSWORD,
    providerId: "credential",
    userId: user.id,
  }));

  await prisma.account.createMany({
    data: accountData,
    skipDuplicates: true,
  });
}
