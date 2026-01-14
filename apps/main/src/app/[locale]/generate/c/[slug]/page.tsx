import { Suspense } from "react";
import {
  GenerateCourseContent,
  GenerateCourseFallback,
} from "./generate-course-content";

export default function GenerateCoursePage(
  props: PageProps<"/[locale]/generate/c/[slug]">,
) {
  return (
    <Suspense fallback={<GenerateCourseFallback />}>
      <GenerateCourseContent params={props.params} />
    </Suspense>
  );
}
