import { Suspense } from "react";
import { GenerateChapterContent, GenerateChapterFallback } from "./generate-chapter-content";

export const prefetch = "force-disabled";

export default function GenerateChapterPage(props: PageProps<"/[lang]/generate/ch/[id]">) {
  return (
    <Suspense fallback={<GenerateChapterFallback />}>
      <GenerateChapterContent params={props.params} />
    </Suspense>
  );
}
