import "server-only";

import { prisma } from "@zoonk/db";
import { cacheTagUsers } from "@zoonk/utils/cache";
import { cacheLife, cacheTag } from "next/cache";

export async function countUsers() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTagUsers());

  return prisma.user.count();
}
