import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";

const cachedGetCourse = cache(async (brandSlug: string, courseSlug: string) =>
  prisma.course.findFirst({
    include: {
      categories: true,
      organization: true,
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

export function getCourse(params: { brandSlug: string; courseSlug: string }) {
  return cachedGetCourse(params.brandSlug, params.courseSlug);
}

export type CourseWithDetails = NonNullable<Awaited<ReturnType<typeof getCourse>>>;
