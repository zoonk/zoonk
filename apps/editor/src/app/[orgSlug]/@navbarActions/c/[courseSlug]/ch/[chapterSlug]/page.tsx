import { Suspense } from "react";
import { ChapterActions } from "./chapter-actions";
import { ChapterActionsSkeleton } from "./chapter-actions-skeleton";

export default async function ChapterNavbarActions(
  props: PageProps<"/[orgSlug]/c/[courseSlug]/ch/[chapterSlug]">,
) {
  return (
    <Suspense fallback={<ChapterActionsSkeleton />}>
      <ChapterActions params={props.params} />
    </Suspense>
  );
}
