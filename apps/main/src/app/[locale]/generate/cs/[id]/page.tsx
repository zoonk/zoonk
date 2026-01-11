import { Suspense } from "react";
import {
  GenerateCourseSuggestionContent,
  GenerateCourseSuggestionFallback,
} from "./generate-course-suggestion-content";

export default function GenerateCoursePage(
  _props: PageProps<"/[locale]/generate/cs/[id]">,
) {
  return (
    <Suspense fallback={<GenerateCourseSuggestionFallback />}>
      <GenerateCourseSuggestionContent />
    </Suspense>
  );
}
