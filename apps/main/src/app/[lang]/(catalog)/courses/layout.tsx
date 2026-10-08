import { getCategories, getCategoryTitle } from "@/lib/categories/category";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CatalogHeader } from "../_components/catalog-title";
import { CategoryPills, CategoryPillsSkeleton } from "./category-pills";

async function CategoryPillsWithData() {
  const categories = await getCategories();
  return <CategoryPills categories={categories.map(({ key, label }) => ({ key, label }))} />;
}

/** Every category's large title, so the header follows the chosen chip without waiting. */
async function getCategoryTitles(): Promise<Record<string, string>> {
  const categories = await getCategories();
  const titles = await Promise.all(categories.map(({ key }) => getCategoryTitle(key)));

  return Object.fromEntries(categories.map(({ key }, index) => [key, titles[index] ?? key]));
}

/**
 * The catalog's large title and its one line first, then the categories, which stay put while the
 * courses under them change and stay in reach under the bar while the list scrolls.
 */
export default async function CoursesLayout({ children }: LayoutProps<"/[lang]/courses">) {
  const [t, categoryTitles] = await Promise.all([getExtracted(), getCategoryTitles()]);

  return (
    <div className="flex flex-col gap-5">
      <CatalogHeader
        allTitle={t("Explore courses")}
        categoryTitles={categoryTitles}
        subtitle={t("Pick a course to start a goal.")}
      />

      <div className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-16 z-20 -my-2 py-2 backdrop-blur">
        <Suspense fallback={<CategoryPillsSkeleton />}>
          <CategoryPillsWithData />
        </Suspense>
      </div>

      {children}
    </div>
  );
}
