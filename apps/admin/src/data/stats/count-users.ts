import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const countUsers = cacheAdminData(() => prisma.user.count());
