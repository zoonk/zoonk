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
  };
  categories: { category: string }[];
};

export const getCourse = cache(
  async (params: {
    brandSlug: string;
    courseSlug: string;
    language: string;
  }): Promise<CourseWithDetails | null> =>
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
        language: params.language,
        organization: {
          kind: "brand",
          slug: params.brandSlug,
        },
        slug: params.courseSlug,
      },
    }),
);
