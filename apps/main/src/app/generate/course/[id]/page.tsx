import { Suspense } from "react";
import {
  GenerateCourseStartRequestContent,
  GenerateCourseStartRequestFallback,
} from "./generate-course-start-request-content";

export default function GenerateCoursePage(props: PageProps<"/generate/course/[id]">) {
  return (
    <Suspense fallback={<GenerateCourseStartRequestFallback />}>
      <GenerateCourseStartRequestContent params={props.params} />
    </Suspense>
  );
}
