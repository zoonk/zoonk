import { type PrismaClient } from "../../generated/prisma/client";
import { type SeedUsers } from "./users";

export async function seedSubscriptions(prisma: PrismaClient, users: SeedUsers): Promise<void> {
  const userIds = Object.values(users).map((user) => String(user.id));

  await prisma.subscription.deleteMany({
    where: { referenceId: { in: userIds } },
  });

  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  const subscriptionData = Object.values(users).map((user) => ({
    periodEnd: oneYearFromNow,
    periodStart: now,
    plan: "hobby",
    referenceId: String(user.id),
    status: "active",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  }));

  await prisma.subscription.createMany({
    data: subscriptionData,
  });
}
