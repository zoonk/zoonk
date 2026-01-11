import { Suspense } from "react";
import {
  GenerateChapterContent,
  GenerateChapterFallback,
} from "./generate-chapter-content";

export default function GenerateChapterPage(
  _props: PageProps<"/[locale]/generate/ch/[id]">,
) {
  return (
    <Suspense fallback={<GenerateChapterFallback />}>
      <GenerateChapterContent />
    </Suspense>
  );
}
