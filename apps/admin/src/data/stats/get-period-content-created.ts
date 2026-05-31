import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";

export const getPeriodContentCreated = cacheAdminData(async (start: Date, end: Date) => {
  const [courses, lessons] = await Promise.all([
    prisma.course.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.lesson.count({ where: { createdAt: { gte: start, lte: end } } }),
  ]);

  return { courses, lessons };
});
