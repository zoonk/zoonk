import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_PROVIDER_ID = "apple";

export function appleAccountFixture({
  accountId = `apple-${randomUUID()}`,
  userId,
}: {
  accountId?: string;
  userId: string;
}) {
  return prisma.account.create({
    data: {
      accountId,
      id: randomUUID(),
      issuer: APPLE_ISSUER,
      providerId: APPLE_PROVIDER_ID,
      userId,
    },
  });
}
