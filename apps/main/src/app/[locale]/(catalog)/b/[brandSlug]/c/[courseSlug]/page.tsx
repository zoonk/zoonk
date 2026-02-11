"use cache";

import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogContainer, CatalogToolbar } from "@/components/catalog/catalog-list";
import { ContinueActivityLink } from "@/components/catalog/continue-activity-link";
import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import { redirect } from "@/i18n/navigation";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChapterList } from "./chapter-list";
import { CourseHeader } from "./course-header";

export async function generateStaticParams() {
  return [{ brandSlug: AI_ORG_SLUG, courseSlug: "sample", locale: "en" }];
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
    redirect({ href: `/generate/c/${course.slug}`, locale });
  }

  return (
    <main className="flex flex-1 flex-col">
      <CourseHeader brandSlug={brandSlug} course={course} />

      <CatalogContainer>
        <CatalogToolbar>
          <ContinueActivityLink
            courseId={course.id}
            fallbackHref={`/b/${brandSlug}/c/${courseSlug}/ch/${chapters[0]?.slug}`}
          />
          <CatalogActions />
        </CatalogToolbar>

        <Suspense>
          <ChapterList brandSlug={brandSlug} chapters={chapters} courseSlug={courseSlug} />
        </Suspense>
      </CatalogContainer>
    </main>
  );
}
