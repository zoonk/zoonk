import "server-only";
import { prisma } from "@zoonk/db";
import { getSitemapCourseWhere } from "./course-where";

export const SITEMAP_BATCH_SIZE = 5000;

export async function countSitemapCourses(): Promise<number> {
  return prisma.course.count({ where: await getSitemapCourseWhere() });
}

export async function listSitemapCourses(
  page: number,
): Promise<{ brandSlug: string; courseSlug: string; language: string; updatedAt: Date }[]> {
  const courses = await prisma.course.findMany({
    include: { organization: true },
    orderBy: { id: "asc" },
    skip: page * SITEMAP_BATCH_SIZE,
    take: SITEMAP_BATCH_SIZE,
    where: await getSitemapCourseWhere(),
  });

  return courses.map((course) => ({
    brandSlug: course.organization?.slug ?? "",
    courseSlug: course.slug,
    language: course.language,
    updatedAt: course.updatedAt,
  }));
}
