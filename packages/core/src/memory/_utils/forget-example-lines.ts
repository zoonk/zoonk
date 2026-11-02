import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";

export async function forgetExampleLines({
  client = prisma,
  userId,
}: {
  client?: TransactionClient;
  userId: string;
}): Promise<void> {
  await client.stepExampleLine.deleteMany({ where: { userId } });
}
