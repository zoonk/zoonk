import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

/**
 * The editor reads the complete prompt row because classification fields are
 * coupled to its language metadata and current generation state.
 */
export const getCoursePrompt = cacheAdminData((id: string) =>
  prisma.coursePrompt.findUnique({ where: { id } }),
);
