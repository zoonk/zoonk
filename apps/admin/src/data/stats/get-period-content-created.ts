import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const getPeriodContentCreated = cache(async (start: Date, end: Date) => {
  const [courses, lessons, activities] = await Promise.all([
    prisma.course.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.lesson.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.activity.count({ where: { createdAt: { gte: start, lte: end } } }),
  ]);

  return { activities, courses, lessons };
});
