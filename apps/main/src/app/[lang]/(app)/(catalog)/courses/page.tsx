import { getCategoryNames } from "@/lib/categories/category";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { LIST_COURSES_LIMIT, listCourses } from "@zoonk/core/courses/list";
import { type Metadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import { lang } from "next/root-params";
import { CourseListClient } from "./course-list-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const language = await lang();

  return {
    alternates: { canonical: getLocalizedUrl({ href: "/courses", language }) },
    description: t(
      "Explore all Zoonk courses to learn anything using AI. Find interactive lessons to learn subjects like science, math, technology, and more.",
    ),
    robots: { follow: true, index: true },
    title: t("Explore courses"),
  };
}

export default async function Courses() {
  const locale = await getLocale();
  const subjectNames = await getCategoryNames();
  const courses = await listCourses({ language: locale });

  return (
    <CourseListClient
      initialCourses={courses}
      language={locale}
      limit={LIST_COURSES_LIMIT}
      subjectNames={subjectNames}
    />
  );
}
