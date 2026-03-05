import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const countContent = cache(async () => {
  const [courses, chapters, lessons, activities, steps] = await Promise.all([
    prisma.course.count(),
    prisma.chapter.count(),
    prisma.lesson.count(),
    prisma.activity.count(),
    prisma.step.count(),
  ]);

  return { activities, chapters, courses, lessons, steps };
});
