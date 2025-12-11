import {
  CommandPaletteCourses,
  CommandPaletteCoursesSkeleton,
} from "@zoonk/next/patterns/command-palette";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CatalogCommandPaletteDialog } from "../command-palette-dialog";

type CommandPalettePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommandPalettePage({
  searchParams,
}: CommandPalettePageProps) {
  const search = await searchParams;
  const query = Array.isArray(search.q) ? search.q[0] : search.q;
  const t = await getExtracted();

  return (
    <CatalogCommandPaletteDialog>
      <Suspense fallback={<CommandPaletteCoursesSkeleton />}>
        <CommandPaletteCourses
          getLinkUrl={(courseSlug: string) => `/courses/${courseSlug}`}
          heading={t("AI Courses")}
          orgSlug="ai"
          query={query ?? ""}
        />
      </Suspense>
    </CatalogCommandPaletteDialog>
  );
}
