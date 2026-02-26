import { Suspense } from "react";
import { CategoryPills, CategoryPillsSkeleton } from "./category-pills";

export default async function CoursesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<CategoryPillsSkeleton />}>
        <CategoryPills />
      </Suspense>

      {children}
    </>
  );
}
