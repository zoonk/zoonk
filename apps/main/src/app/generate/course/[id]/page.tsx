import { Suspense } from "react";
import {
  GenerateCoursePromptContent,
  GenerateCoursePromptFallback,
} from "./generate-course-prompt-content";

export default function GenerateCoursePage(props: PageProps<"/generate/course/[id]">) {
  return (
    <Suspense fallback={<GenerateCoursePromptFallback />}>
      <GenerateCoursePromptContent params={props.params} />
    </Suspense>
  );
}
