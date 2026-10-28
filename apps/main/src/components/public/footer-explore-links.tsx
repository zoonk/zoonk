import { getCourseHref } from "@/data/courses/course-href";
import { Link } from "@/i18n/navigation";
import { getCategories } from "@/lib/categories/category";
import { countCatalogCourses } from "@zoonk/core/courses/count-catalog";
import { listCourses } from "@zoonk/core/courses/list";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";

const POPULAR_COURSES_LIMIT = 6;

const LINK_CLASS =
  "hover:text-foreground focus-visible:ring-ring/50 inline-flex min-h-11 min-w-11 items-center rounded-md text-pretty outline-none transition-colors focus-visible:ring-[3px]";

const LIST_TITLE_CLASS = "text-[0.8125rem] font-semibold";

async function getPopularCourses(language: string) {
  "use cache";

  const courses = await listCourses({ language, limit: POPULAR_COURSES_LIMIT });

  return courses.map((course) => ({
    href: getCourseHref({ brandSlug: course.organization.slug, courseSlug: course.slug }),
    id: course.id,
    title: course.title,
  }));
}

async function PopularCourses({ language }: { language: string }) {
  const t = await getExtracted();
  const courses = await getPopularCourses(language);

  if (courses.length === 0) {
    return null;
  }

  return (
    <nav aria-labelledby="footer-popular-courses">
      <h2 className={LIST_TITLE_CLASS} id="footer-popular-courses">
        {t("Popular courses")}
      </h2>
      <ul className="text-muted-foreground mt-1 grid grid-cols-1 gap-x-6 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <li key={course.id}>
            <Link className={LINK_CLASS} href={course.href} prefetch>
              {course.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** An empty category's page would only offer to start a goal, so the footer leaves it out. */
async function CourseCategories({ language }: { language: string }) {
  const t = await getExtracted();
  const categories = await getCategories();
  const counts = await countCatalogCourses({ language });

  const listed = new Set(
    counts.categories.filter((item) => item.courseCount > 0).map((item) => item.category),
  );

  const links = categories
    .filter((category) => listed.has(category.key))
    .toSorted((first, second) => first.label.localeCompare(second.label, language));

  if (links.length === 0) {
    return null;
  }

  return (
    <nav aria-labelledby="footer-categories">
      <h2 className={LIST_TITLE_CLASS} id="footer-categories">
        {t("Categories")}
      </h2>
      <ul className="text-muted-foreground mt-1 flex flex-col text-sm">
        {links.map((category) => (
          <li key={category.key}>
            <Link className={LINK_CLASS} href={`/courses/${category.key}`} prefetch>
              {category.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Both lists are cached, so they're part of every page's static HTML rather than streamed after it. */
export async function FooterExploreLinks() {
  const language = getSupportedLocaleFromLanguage(await lang());

  return (
    <div className="grid grid-cols-1 gap-8 pt-12 pb-2 lg:grid-cols-[3fr_1fr] lg:gap-12">
      <PopularCourses language={language} />
      <CourseCategories language={language} />
    </div>
  );
}
