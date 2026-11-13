import { getAppLocale } from "@/i18n/locale";
import { getCategoryNames } from "@/lib/categories/category";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { LIST_COURSES_LIMIT, listCourses } from "@zoonk/core/courses/list";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { CourseListClient } from "./course-list-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  const language = await lang();

  return {
    alternates: { canonical: getLocalizedUrl({ href: "/courses", language }) },
    description: t(
      "Online courses to learn with AI: science, math, languages, exam prep and more. Pick one and get a study plan for each day, in short interactive lessons. Start free.",
    ),
    robots: { follow: true, index: true },
    title: t({
      description: "A search result's title for the list of every course.",
      message: "Online courses with a study plan for each day",
    }),
  };
}

export default async function Courses() {
  const locale = await getAppLocale();
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
