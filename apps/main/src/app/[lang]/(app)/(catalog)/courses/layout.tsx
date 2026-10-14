import { CATALOG_TOP_TARGET_ID } from "@/components/catalog/catalog-top-target";
import { getGoalExample } from "@/components/public/goal-example";
import { GoalForm } from "@/components/public/goal-form";
import { getPathname } from "@/i18n/navigation";
import { getCategories, getCategoryTitles } from "@/lib/categories/category";
import { countCatalogCourses } from "@zoonk/core/courses/count-catalog";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { getExtracted, getLocale } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { CatalogBar } from "../_components/catalog-bar";
import { CatalogHeader } from "../_components/catalog-title";
import { CategoryNav, CategoryNavSkeleton } from "./category-nav";

/** The categories with how many courses each has, in the reader's language like the courses. */
async function CategoryNavWithData() {
  const categories = await getCategories();
  const locale = await getLocale();
  const counts = await countCatalogCourses({ language: locale });
  const courseCounts = new Map(counts.categories.map((item) => [item.category, item.courseCount]));

  return (
    <CategoryNav
      categories={categories.map(({ key, label }) => ({
        courseCount: courseCounts.get(key) ?? 0,
        key,
        label,
      }))}
      total={counts.total}
    />
  );
}

const CATALOG_GOAL_ID = "catalog-goal";

/**
 * The goal box under the catalog's title, for anyone whose goal no course covers (a job, a move, an
 * exam): it starts a plan from their own words, as the home page's does.
 */
async function CatalogGoalBox() {
  const locale = getSupportedLocaleFromLanguage(await lang());
  const example = await getGoalExample();

  return (
    <div className="max-w-column lg:col-span-2">
      <GoalForm
        action={getPathname({ href: "/start", locale })}
        example={example}
        id={CATALOG_GOAL_ID}
      />
    </div>
  );
}

/**
 * Explore courses, the catalog's hub, in the app's frame for everyone: under `lg` its own bar on
 * top (the way back and the account, or a visitor's way in), then the large title and its one
 * line, then the categories, which stay put while the courses beside them (under them on phones
 * and tablets) change: a row of chips kept in reach under the bar (`--catalog-bar`, its height),
 * and from `lg` a column on the left of the courses, where the sidebar has the way back and the
 * account. From `lg` the hub fills the room beside the sidebar and its grid gains columns as the
 * room grows. A course's own pages have their own bar, back to here.
 */
export default async function CoursesLayout({ children }: LayoutProps<"/[lang]/courses">) {
  const t = await getExtracted();
  const categoryTitles = await getCategoryTitles();

  return (
    <div className="flex flex-1 flex-col [--catalog-bar:4rem] lg:[--catalog-bar:0rem]">
      <div aria-hidden="true" className="scroll-mt-24" id={CATALOG_TOP_TARGET_ID} />
      <CatalogBar />

      <div className="flex w-full flex-col gap-5 lg:grid lg:grid-cols-[11.25rem_minmax(0,1fr)] lg:gap-x-10 lg:gap-y-8">
        <CatalogHeader
          allTitle={t("Explore courses")}
          categoryTitles={categoryTitles}
          className="lg:col-span-2"
          subtitle={t("Start from a course, or tell Zoonk what you're getting ready for.")}
        />

        <CatalogGoalBox />

        <Suspense fallback={<CategoryNavSkeleton />}>
          <CategoryNavWithData />
        </Suspense>

        {children}
      </div>
    </div>
  );
}
