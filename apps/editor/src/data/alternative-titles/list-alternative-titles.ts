import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

type ListAlternativeTitlesParams = { courseId: number } | { courseSlug: string };

const cachedListAlternativeTitlesById = cache(async (courseId: number): Promise<string[]> => {
  const results = await prisma.courseAlternativeTitle.findMany({
    orderBy: { slug: "asc" },
    select: { slug: true },
    where: { courseId },
  });

  return results.map((result) => result.slug);
});

const cachedListAlternativeTitlesBySlug = cache(async (courseSlug: string): Promise<string[]> => {
  const results = await prisma.courseAlternativeTitle.findMany({
    orderBy: { slug: "asc" },
    select: { slug: true },
    where: { course: { slug: courseSlug } },
  });

  return results.map((result) => result.slug);
});

export function listAlternativeTitles(params: ListAlternativeTitlesParams): Promise<string[]> {
  if ("courseId" in params) {
    return cachedListAlternativeTitlesById(params.courseId);
  }
  return cachedListAlternativeTitlesBySlug(params.courseSlug);
}
