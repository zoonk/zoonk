"use cache";

import { prisma } from "@zoonk/db";
import { cacheTagCourse } from "@zoonk/utils/cache";
import type { Metadata } from "next";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import { redirect } from "@/i18n/navigation";
import { ChapterSearchContainer } from "./chapter-search-container";
import { CourseHeader } from "./course-header";

export async function generateStaticParams() {
  const course = await prisma.course.findFirst({
    select: { language: true, slug: true },
    where: {
      isPublished: true,
      organization: { kind: "brand", slug: "ai" },
    },
  });

  if (!course) {
    return [];
  }

  return [
    { brandSlug: "ai", courseSlug: course.slug, locale: course.language },
  ];
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]">): Promise<Metadata> {
  const { brandSlug, courseSlug, locale } = await params;
  const course = await getCourse({ brandSlug, courseSlug, language: locale });

  if (!course) {
    return {};
  }

  return {
    description: course.description,
    title: course.title,
  };
}

export default async function CoursePage({
  params,
}: PageProps<"/[locale]/b/[brandSlug]/c/[courseSlug]">) {
  const { brandSlug, courseSlug, locale } = await params;
  setRequestLocale(locale);

  const [course, chapters] = await Promise.all([
    getCourse({ brandSlug, courseSlug, language: locale }),
    listCourseChapters({ brandSlug, courseSlug, language: locale }),
  ]);

  cacheTag(cacheTagCourse({ courseSlug }));

  if (!course) {
    notFound();
  }

  if (chapters.length === 0) {
    redirect({ href: `/generate/c/${course.id}`, locale });
  }

  return (
    <main className="flex flex-1 flex-col">
      <CourseHeader brandSlug={brandSlug} course={course} />

      <div className="mx-auto w-full px-4 py-8 md:py-10 lg:max-w-xl">
        <Suspense>
          <ChapterSearchContainer
            brandSlug={brandSlug}
            chapters={chapters}
            courseSlug={courseSlug}
          />
        </Suspense>
      </div>
    </main>
  );
}
