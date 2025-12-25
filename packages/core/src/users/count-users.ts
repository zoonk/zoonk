import "server-only";

import { prisma } from "@zoonk/db";

export async function countUsers() {
  return prisma.user.count();
}
