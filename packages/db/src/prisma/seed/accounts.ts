import { type PrismaClient, type User } from "../../generated/prisma/client";

const CREDENTIAL_PROVIDER_ID = "credential";
const TEST_PASSWORD = "password123";

/** Gives each user a credential account, so tests and local sign-in can use the test password. */
export async function seedAccounts(
  prisma: PrismaClient,
  users: Readonly<Record<string, Pick<User, "id">>>,
): Promise<void> {
  const accountData = Object.values(users).map((user) => ({
    accountId: user.id,
    password: TEST_PASSWORD,
    providerId: CREDENTIAL_PROVIDER_ID,
    userId: user.id,
  }));

  await prisma.account.createMany({ data: accountData, skipDuplicates: true });
}
