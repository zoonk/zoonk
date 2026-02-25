import { Suspense } from "react";
import { CourseActions } from "./course-actions";
import { CourseActionsSkeleton } from "./course-actions-skeleton";

export default async function CourseNavbarActions(props: PageProps<"/[orgSlug]/c/[courseSlug]">) {
  return (
    <Suspense fallback={<CourseActionsSkeleton />}>
      <CourseActions {...props} />
    </Suspense>
  );
}
