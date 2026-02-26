import { Suspense } from "react";
import { GenerateLessonContent, GenerateLessonFallback } from "./generate-lesson-content";

export default function GenerateLessonPage(props: PageProps<"/generate/l/[id]">) {
  return (
    <Suspense fallback={<GenerateLessonFallback />}>
      <GenerateLessonContent params={props.params} />
    </Suspense>
  );
}
