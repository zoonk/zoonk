import { getCategoryMeta, getCategoryNames } from "@/lib/categories/category";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { LIST_COURSES_LIMIT, listCourses } from "@zoonk/core/courses/list";
import { type CourseCategory } from "@zoonk/utils/categories";
import { type Metadata } from "next";
import { getLocale } from "next-intl/server";
import { lang } from "next/root-params";
import { CourseListClient } from "./course-list-client";

export async function getCategoryPageMetadata(category: CourseCategory): Promise<Metadata> {
  const language = await lang();

  return {
    ...(await getCategoryMeta({ category })),
    alternates: { canonical: getLocalizedUrl({ href: `/courses/${category}`, language }) },
    robots: { follow: true, index: true },
  };
}

/** Each category is its own static route handing its name here (`static-value-routes.test.ts`). */
export async function CategoryCoursesPage({ category }: { category: CourseCategory }) {
  const language = await getLocale();
  const subjectNames = await getCategoryNames();
  const courses = await listCourses({ category, language });

  return (
    <CourseListClient
      category={category}
      initialCourses={courses}
      language={language}
      limit={LIST_COURSES_LIMIT}
      subjectNames={subjectNames}
    />
  );
}
