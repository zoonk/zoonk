"use cache";

import { CatalogActions } from "@/components/catalog/catalog-actions";
import { CatalogContainer, CatalogToolbar } from "@/components/catalog/catalog-list";
import { ContinueActivityLink } from "@/components/catalog/continue-activity-link";
import { ProgressPreloader } from "@/components/catalog/progress-preloader";
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
  const { brandSlug, courseSlug } = await params;
  const course = await getCourse({ brandSlug, courseSlug });

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

  const course = await getCourse({ brandSlug, courseSlug });

  cacheTag(cacheTagCourse({ courseSlug }));

  if (!course) {
    notFound();
  }

  const chapters = await listCourseChapters({ courseId: course.id });

  if (chapters.length === 0) {
    redirect({ href: `/generate/c/${course.slug}`, locale });
  }

  return (
    <main className="flex flex-1 flex-col">
      <ProgressPreloader courseId={course.id} />
      <CourseHeader brandSlug={brandSlug} course={course} />

      <CatalogContainer>
        <CatalogToolbar>
          <ContinueActivityLink
            courseId={course.id}
            fallbackHref={`/b/${brandSlug}/c/${courseSlug}/ch/${chapters[0]?.slug}`}
          />
          <CatalogActions contentId={courseSlug} kind="course" />
        </CatalogToolbar>

        <Suspense>
          <ChapterList
            brandSlug={brandSlug}
            chapters={chapters}
            courseId={course.id}
            courseSlug={courseSlug}
          />
        </Suspense>
      </CatalogContainer>
    </main>
  );
}
