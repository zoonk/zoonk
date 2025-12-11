import {
  CommandPaletteCourses,
  CommandPaletteCoursesSkeleton,
} from "@zoonk/next/patterns/command/courses";
import { safeParams } from "@zoonk/utils/params";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CatalogCommandPaletteDialog } from "../command-palette-dialog";

export default async function CommandPalettePage({
  searchParams,
}: PageProps<"/[locale]/[...catchAll]">) {
  const search = await searchParams;
  const query = safeParams(search.q) ?? "";
  const t = await getExtracted();

  return (
    <CatalogCommandPaletteDialog>
      <Suspense fallback={<CommandPaletteCoursesSkeleton />}>
        <CommandPaletteCourses
          getLinkUrl={(courseSlug: string) => `/c/${courseSlug}`}
          heading={t("Courses")}
          orgSlug="ai"
          query={query}
        />
      </Suspense>
    </CatalogCommandPaletteDialog>
  );
}
