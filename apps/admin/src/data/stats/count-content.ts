import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export const countContent = cache(async () => {
  const [chapters, lessons, activities, steps] = await Promise.all([
    prisma.chapter.count(),
    prisma.lesson.count(),
    prisma.activity.count(),
    prisma.step.count(),
  ]);

  return { activities, chapters, lessons, steps };
});
