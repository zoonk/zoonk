import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

export type CourseWithDetails = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  organization: {
    name: string;
    slug: string;
    logo: string | null;
  } | null;
  categories: { category: string }[];
};

const cachedGetCourse = cache(
  async (brandSlug: string, courseSlug: string): Promise<CourseWithDetails | null> =>
    prisma.course.findFirst({
      select: {
        categories: {
          select: { category: true },
        },
        description: true,
        id: true,
        imageUrl: true,
        organization: {
          select: { logo: true, name: true, slug: true },
        },
        slug: true,
        title: true,
      },
      where: {
        isPublished: true,
        organization: {
          kind: "brand",
          slug: brandSlug,
        },
        slug: courseSlug,
      },
    }),
);

export function getCourse(params: {
  brandSlug: string;
  courseSlug: string;
}): Promise<CourseWithDetails | null> {
  return cachedGetCourse(params.brandSlug, params.courseSlug);
}
