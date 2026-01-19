import { Suspense } from "react";
import {
  GenerateLessonContent,
  GenerateLessonFallback,
} from "./generate-lesson-content";

export default function GenerateLessonActivitiesPage(
  props: PageProps<"/[locale]/generate/l/[id]">,
) {
  return (
    <Suspense fallback={<GenerateLessonFallback />}>
      <GenerateLessonContent params={props.params} />
    </Suspense>
  );
}
