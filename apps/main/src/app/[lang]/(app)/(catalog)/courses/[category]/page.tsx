import { getCategoryMeta } from "@/lib/categories/category";
import { getLocalizedUrl } from "@/lib/metadata/localized-url";
import { LIST_COURSES_LIMIT, listCourses } from "@zoonk/core/courses/list";
import { COURSE_CATEGORIES, isValidCategory } from "@zoonk/utils/categories";
import { type Metadata } from "next";
import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CourseListClient } from "../course-list-client";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/courses/[category]">): Promise<Metadata> {
  const { category, lang } = await params;

  if (!isValidCategory(category)) {
    return {};
  }

  return {
    ...(await getCategoryMeta({ category })),
    alternates: { canonical: getLocalizedUrl({ href: `/courses/${category}`, language: lang }) },
    robots: { follow: true, index: true },
  };
}

/** Pre-renders every category from the shared fixed taxonomy. */
export function generateStaticParams() {
  return COURSE_CATEGORIES.map((category) => ({ category }));
}

/** A category's courses, under the catalog's title (named after the category) and chips. */
export default async function CategoryCourses({ params }: PageProps<"/[lang]/courses/[category]">) {
  const { category } = await params;

  if (!isValidCategory(category)) {
    notFound();
  }

  const locale = await getLocale();
  const courses = await listCourses({ category, language: locale });

  return (
    <CourseListClient
      category={category}
      initialCourses={courses}
      language={locale}
      limit={LIST_COURSES_LIMIT}
    />
  );
}
