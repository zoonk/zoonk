"use cache";

import { listCourseChapters } from "@/data/chapters/list-course-chapters";
import { getCourse } from "@/data/courses/get-course";
import { redirect } from "@/i18n/navigation";
import { cacheTagCourse } from "@zoonk/utils/cache";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type Metadata } from "next";
import { getExtracted, setRequestLocale } from "next-intl/server";
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

  const t = await getExtracted();

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

      <div className="mx-auto w-full px-4 py-8 md:py-10 lg:max-w-xl">
        <Suspense>
          <ChapterList
            brandSlug={brandSlug}
            chapters={chapters}
            courseSlug={courseSlug}
            emptyMessage={t("No chapters found")}
            placeholder={t("Search chapters...")}
            searchLabel={t("Search chapters")}
          />
        </Suspense>
      </div>
    </main>
  );
}
