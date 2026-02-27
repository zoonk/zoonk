import { getCategories } from "@/lib/categories/category";
import { Suspense } from "react";
import { CategoryPills, CategoryPillsSkeleton } from "./category-pills";

async function CategoryPillsWithData() {
  const categories = await getCategories();
  return <CategoryPills categories={categories.map(({ key, label }) => ({ key, label }))} />;
}

export default async function CoursesLayout({ children }: LayoutProps<"/courses">) {
  return (
    <>
      <Suspense fallback={<CategoryPillsSkeleton />}>
        <CategoryPillsWithData />
      </Suspense>

      {children}
    </>
  );
}
