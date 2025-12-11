import {
  CommandPaletteCourses,
  CommandPaletteCoursesSkeleton,
} from "@zoonk/next/patterns/command/courses";
import { safeParams } from "@zoonk/utils/params";
import { getExtracted } from "next-intl/server";
import { Suspense } from "react";
import { CommandPaletteDialog } from "./command-palette-dialog";

type CommandPalettePageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CommandPalettePage({
  params,
  searchParams,
}: CommandPalettePageProps) {
  const { orgSlug } = await params;
  const search = await searchParams;
  const query = safeParams(search.q);
  const t = await getExtracted();

  return (
    <CommandPaletteDialog>
      <Suspense fallback={<CommandPaletteCoursesSkeleton />}>
        <CommandPaletteCourses
          getLinkUrl={(courseSlug: string) =>
            `/${orgSlug}/courses/${courseSlug}`
          }
          heading={t("Courses")}
          orgSlug={orgSlug}
          query={query ?? ""}
        />
      </Suspense>
    </CommandPaletteDialog>
  );
}
