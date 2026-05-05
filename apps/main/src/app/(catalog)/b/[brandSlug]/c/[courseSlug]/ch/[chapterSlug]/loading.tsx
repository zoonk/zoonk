import { CatalogPageSkeleton } from "@/components/catalog/catalog-skeletons";

export default function ChapterLoading() {
  return (
    <main className="flex flex-1 flex-col gap-4">
      <CatalogPageSkeleton />
    </main>
  );
}
