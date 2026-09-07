import { type PrismaClient } from "../../generated/prisma/client";
import { type SeedUsers } from "./users";

const CREDENTIAL_PROVIDER_ID = "credential";
const TEST_PASSWORD = "password123";

export async function seedAccounts(prisma: PrismaClient, users: SeedUsers): Promise<void> {
  const accountData = Object.values(users).map((user) => ({
    accountId: user.id,
    password: TEST_PASSWORD,
    providerId: CREDENTIAL_PROVIDER_ID,
    userId: user.id,
  }));

  await prisma.account.createMany({ data: accountData, skipDuplicates: true });
}
