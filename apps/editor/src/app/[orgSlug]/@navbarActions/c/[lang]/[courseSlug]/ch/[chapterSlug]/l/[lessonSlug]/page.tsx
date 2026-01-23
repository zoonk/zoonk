import { Suspense } from "react";
import { LessonActions } from "./lesson-actions";
import { LessonActionsSkeleton } from "./lesson-actions-skeleton";

type LessonNavbarActionsPageProps =
  PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">;

export default async function LessonNavbarActions(props: LessonNavbarActionsPageProps) {
  return (
    <Suspense fallback={<LessonActionsSkeleton />}>
      <LessonActions params={props.params} />
    </Suspense>
  );
}
