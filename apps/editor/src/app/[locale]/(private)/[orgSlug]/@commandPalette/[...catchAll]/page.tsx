import { Suspense } from "react";
import {
  CommandPaletteCourses,
  CommandPaletteCoursesSkeleton,
} from "../command-palette-courses";
import { CommandPaletteDialog } from "../command-palette-dialog";

type CommandPaletteCatchAllProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommandPaletteCatchAll({
  params,
  searchParams,
}: CommandPaletteCatchAllProps) {
  const { orgSlug } = await params;
  const search = await searchParams;
  const query = Array.isArray(search.q) ? search.q[0] : search.q;

  return (
    <CommandPaletteDialog>
      <Suspense fallback={<CommandPaletteCoursesSkeleton />}>
        <CommandPaletteCourses orgSlug={orgSlug} query={query ?? ""} />
      </Suspense>
    </CommandPaletteDialog>
  );
}
