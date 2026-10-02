import { getCourseHref } from "@/data/courses/course-href";
import { Link } from "@/i18n/navigation";
import { getCategories } from "@/lib/categories/category";
import { listCourses } from "@zoonk/core/courses/list";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";

const TOP_COURSES_LIMIT = 8;

/** Each link is a 44 px row, so the lists need no gap between them. */
const LINK_CLASS =
  "hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-11 min-w-11 items-center rounded-md outline-none transition-colors focus-visible:ring-[3px]";

/** Only what the links need is cached, keyed by the language alone. */
async function getPopularCourses(language: string) {
  "use cache";

  const courses = await listCourses({ language, limit: TOP_COURSES_LIMIT });

  return courses.map((course) => ({
    href: getCourseHref({ brandSlug: course.organization.slug, courseSlug: course.slug }),
    id: course.id,
    title: course.title,
  }));
}

/** The most popular courses in this language, streamed on their own so the page never waits on them. */
async function PopularCourses({ locale }: { locale: string }) {
  const [t, courses] = await Promise.all([getExtracted(), getPopularCourses(locale)]);

  if (courses.length === 0) {
    return null;
  }

  return (
    <nav aria-labelledby="explore-courses">
      <h2 className="text-sm font-semibold" id="explore-courses">
        {t("Popular courses")}
      </h2>
      <ul className="text-muted-foreground mt-1 flex flex-col text-sm">
        {courses.map((course) => (
          <li key={course.id}>
            <Link className={LINK_CLASS} href={course.href}>
              {course.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Course categories and the most popular courses in this language, so
 * visitors (and search engines) can go straight to the catalog.
 */
export async function HomeExploreLinks({ locale }: { locale: string }) {
  const [t, categories] = await Promise.all([getExtracted(), getCategories()]);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 pt-10 sm:grid-cols-2 sm:px-8 lg:grid-cols-[2fr_1fr]">
      <nav aria-labelledby="explore-categories">
        <h2 className="text-sm font-semibold" id="explore-categories">
          {t("Course categories")}
        </h2>
        <ul className="text-muted-foreground mt-1 grid grid-cols-2 gap-x-6 text-sm sm:grid-cols-3">
          {categories.map((category) => (
            <li key={category.key}>
              <Link className={LINK_CLASS} href={`/courses/${category.key}`}>
                {category.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Suspense fallback={null}>
        <PopularCourses locale={locale} />
      </Suspense>
    </div>
  );
}
