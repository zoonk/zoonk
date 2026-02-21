import "server-only";
import { prisma } from "@zoonk/db";

export const SITEMAP_BATCH_SIZE = 5000;

export async function countSitemapCourses(): Promise<number> {
  return prisma.course.count({
    where: {
      isPublished: true,
      organization: { kind: "brand" },
    },
  });
}

export async function listSitemapCourses(page: number): Promise<
  {
    brandSlug: string;
    courseSlug: string;
    language: string;
    updatedAt: Date;
  }[]
> {
  const courses = await prisma.course.findMany({
    orderBy: { id: "asc" },
    select: {
      language: true,
      organization: { select: { slug: true } },
      slug: true,
      updatedAt: true,
    },
    skip: page * SITEMAP_BATCH_SIZE,
    take: SITEMAP_BATCH_SIZE,
    where: {
      isPublished: true,
      organization: { kind: "brand" },
    },
  });

  return courses.map((course) => ({
    brandSlug: course.organization?.slug ?? "",
    courseSlug: course.slug,
    language: course.language,
    updatedAt: course.updatedAt,
  }));
}
