import { CatalogPageSkeleton } from "@/components/catalog/catalog-skeletons";

export default function CourseLoading() {
  return (
    <main className="flex flex-1 flex-col gap-4">
      <CatalogPageSkeleton />
    </main>
  );
}
