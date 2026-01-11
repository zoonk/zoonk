import { Suspense } from "react";
import {
  GenerateCourseContent,
  GenerateCourseFallback,
} from "./generate-course-content";

export default function GenerateCoursePage(
  _props: PageProps<"/[locale]/generate/c/[id]">,
) {
  return (
    <Suspense fallback={<GenerateCourseFallback />}>
      <GenerateCourseContent />
    </Suspense>
  );
}
