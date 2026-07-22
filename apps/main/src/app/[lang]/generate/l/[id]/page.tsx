import { Suspense } from "react";
import { GenerateLessonContent, GenerateLessonFallback } from "./generate-lesson-content";

export const prefetch = "force-disabled";

export default function GenerateLessonPage(props: PageProps<"/[lang]/generate/l/[id]">) {
  return (
    <Suspense fallback={<GenerateLessonFallback />}>
      <GenerateLessonContent params={props.params} />
    </Suspense>
  );
}
