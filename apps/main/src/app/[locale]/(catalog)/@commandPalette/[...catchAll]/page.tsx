import { Suspense } from "react";
import {
  CatalogCommandPaletteCourses,
  CatalogCommandPaletteCoursesSkeleton,
} from "../../command-palette-courses";
import { CatalogCommandPaletteDialog } from "../../command-palette-dialog";

type CommandPalettePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommandPalettePage({
  searchParams,
}: CommandPalettePageProps) {
  const search = await searchParams;
  const query = Array.isArray(search.q) ? search.q[0] : search.q;

  return (
    <CatalogCommandPaletteDialog>
      <Suspense fallback={<CatalogCommandPaletteCoursesSkeleton />}>
        <CatalogCommandPaletteCourses query={query ?? ""} />
      </Suspense>
    </CatalogCommandPaletteDialog>
  );
}
