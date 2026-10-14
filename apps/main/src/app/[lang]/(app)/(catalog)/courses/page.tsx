import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { LIST_COURSES_LIMIT, listCourses } from "@zoonk/core/courses/list";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { Suspense } from "react";
import { CourseListClient } from "./course-list-client";
import { CourseListSkeleton } from "./course-list-skeleton";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/courses">): Promise<Metadata> {
  const { lang } = await params;
  const t = await getExtracted();

  return {
    alternates: { canonical: getLocalizedUrl({ href: "/courses", language: lang }) },
    description: t(
      "Explore all Zoonk courses to learn anything using AI. Find interactive lessons to learn subjects like science, math, technology, and more.",
    ),
    robots: { follow: true, index: true },
    title: t("Explore courses"),
  };
}

async function CourseListContent() {
  const locale = await getLocale();
  const courses = await listCourses({ language: locale });
  return <CourseListClient initialCourses={courses} language={locale} limit={LIST_COURSES_LIMIT} />;
}

/** Every course in the learner's language, under the catalog's title and chips (its layout). */
export default function Courses() {
  return (
    <Suspense fallback={<CourseListSkeleton />}>
      <CourseListContent />
    </Suspense>
  );
}
