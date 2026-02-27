import { CatalogPageSkeleton } from "@/components/catalog/catalog-skeletons";

export default function LessonLoading() {
  return (
    <main className="flex flex-1 flex-col">
      <CatalogPageSkeleton listVariant="indicator" showSearch={false} />
    </main>
  );
}
