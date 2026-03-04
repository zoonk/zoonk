import "server-only";
import { getSession } from "@zoonk/core/users/session/get";
import { prisma } from "@zoonk/db";

export async function getUserSubscription(userId: number) {
  const session = await getSession();

  if (session?.user.role !== "admin") {
    return null;
  }

  return prisma.subscription.findFirst({
    orderBy: { id: "desc" },
    where: { referenceId: String(userId) },
  });
}
