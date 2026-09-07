import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";

const APPLE_PROVIDER_ID = "apple";

export function appleAccountFixture({
  accountId = `apple-${randomUUID()}`,
  userId,
}: {
  accountId?: string;
  userId: string;
}) {
  return prisma.account.create({
    data: { accountId, id: randomUUID(), providerId: APPLE_PROVIDER_ID, userId },
  });
}
