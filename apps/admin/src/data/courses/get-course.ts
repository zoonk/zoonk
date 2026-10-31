import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getCourse = cacheAdminData((id: string) =>
  prisma.course.findUnique({ where: { id } }),
);
