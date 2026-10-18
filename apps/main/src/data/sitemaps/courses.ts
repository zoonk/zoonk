import "server-only";
import { prisma } from "@zoonk/db";
import { cacheLife } from "next/cache";
import { getSitemapCourseWhere } from "./course-where";
import { getSitemapPageRowIds, isSitemapPage, warnIfSitemapPageIsFull } from "./sitemap-pages";

type SitemapCourse = { brandSlug: string; courseSlug: string; language: string; updatedAt: Date };

/** A page's courses (`getSitemapPage`), read once a day. */
async function listSitemapCoursePage(page: number): Promise<SitemapCourse[]> {
  "use cache";
  cacheLife("days");

  const where = await getSitemapCourseWhere();
  const listed = await prisma.course.findMany({ select: { id: true }, where });
  const ids = getSitemapPageRowIds({ listed, page, resource: "courses" });
  warnIfSitemapPageIsFull({ page, resource: "courses", rows: ids.length });

  const courses = await prisma.course.findMany({
    orderBy: { id: "asc" },
    select: {
      language: true,
      organization: { select: { slug: true } },
      slug: true,
      updatedAt: true,
    },
    where: { ...where, id: { in: ids } },
  });

  return courses.map((course) => ({
    brandSlug: course.organization?.slug ?? "",
    courseSlug: course.slug,
    language: course.language,
    updatedAt: course.updatedAt,
  }));
}

export async function listSitemapCourses(page: number): Promise<SitemapCourse[]> {
  return isSitemapPage({ page, resource: "courses" }) ? listSitemapCoursePage(page) : [];
}
