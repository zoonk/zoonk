import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

/**
 * Course editing only needs the model fields, so the detail query avoids
 * loading curriculum relations that the title and slug form never renders.
 */
export const getCourse = cacheAdminData((id: string) =>
  prisma.course.findUnique({ where: { id } }),
);
