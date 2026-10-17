import { getCategoryMeta } from "@/lib/categories/category";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { LIST_COURSES_LIMIT, listCourses } from "@zoonk/core/courses/list";
import { type CourseCategory } from "@zoonk/utils/categories";
import { type Metadata } from "next";
import { getLocale } from "next-intl/server";
import { lang } from "next/root-params";
import { CourseListClient } from "./course-list-client";

/** A category page's headline, description and address, from the shared taxonomy. */
export async function getCategoryPageMetadata(category: CourseCategory): Promise<Metadata> {
  const language = await lang();

  return {
    ...(await getCategoryMeta({ category })),
    alternates: { canonical: getLocalizedUrl({ href: `/courses/${category}`, language }) },
    robots: { follow: true, index: true },
  };
}

/**
 * A category's courses, under the catalog's title (named after the category) and chips. Each
 * category has its own static route (`courses/<category>/page.tsx`) handing its name here, so no
 * page reads it from the address and every one is fully static; `static-value-routes.test.ts`
 * keeps those folders exactly in step with `COURSE_CATEGORIES`.
 */
export async function CategoryCoursesPage({ category }: { category: CourseCategory }) {
  const language = await getLocale();
  const courses = await listCourses({ category, language });

  return (
    <CourseListClient
      category={category}
      initialCourses={courses}
      language={language}
      limit={LIST_COURSES_LIMIT}
    />
  );
}
