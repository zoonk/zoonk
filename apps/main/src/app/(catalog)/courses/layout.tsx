import { getCategories } from "@/lib/categories/category";
import { Suspense } from "react";
import { CategoryPills, CategoryPillsSkeleton } from "./category-pills";

async function CategoryPillsWithData() {
  const categories = await getCategories();
  return <CategoryPills categories={categories.map(({ key, label }) => ({ key, label }))} />;
}

export default async function CoursesLayout({ children }: LayoutProps<"/courses">) {
  return (
    <div className="flex w-full flex-col gap-4">
      <Suspense fallback={<CategoryPillsSkeleton />}>
        <CategoryPillsWithData />
      </Suspense>

      {children}
    </div>
  );
}
