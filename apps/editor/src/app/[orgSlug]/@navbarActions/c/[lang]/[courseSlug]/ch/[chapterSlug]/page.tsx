import { Suspense } from "react";
import { ChapterActions } from "./chapter-actions";
import { ChapterActionsSkeleton } from "./chapter-actions-skeleton";

type ChapterNavbarActionsPageProps = PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]">;

export default async function ChapterNavbarActions(props: ChapterNavbarActionsPageProps) {
  return (
    <Suspense fallback={<ChapterActionsSkeleton />}>
      <ChapterActions params={props.params} />
    </Suspense>
  );
}
