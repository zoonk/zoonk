import { Suspense } from "react";
import { LessonActions } from "./lesson-actions";
import { LessonActionsSkeleton } from "./lesson-actions-skeleton";

export default async function LessonNavbarActions(
  props: PageProps<"/[orgSlug]/c/[lang]/[courseSlug]/ch/[chapterSlug]/l/[lessonSlug]">,
) {
  return (
    <Suspense fallback={<LessonActionsSkeleton />}>
      <LessonActions params={props.params} />
    </Suspense>
  );
}
