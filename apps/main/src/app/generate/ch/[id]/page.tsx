import { Suspense } from "react";
import { GenerateChapterContent, GenerateChapterFallback } from "./generate-chapter-content";

export default function GenerateChapterPage(props: PageProps<"/generate/ch/[id]">) {
  return (
    <Suspense fallback={<GenerateChapterFallback />}>
      <GenerateChapterContent params={props.params} />
    </Suspense>
  );
}
