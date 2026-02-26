import { Suspense } from "react";
import {
  GenerateCourseSuggestionContent,
  GenerateCourseSuggestionFallback,
} from "./generate-course-suggestion-content";

export default function GenerateCoursePage(props: PageProps<"/generate/cs/[id]">) {
  return (
    <Suspense fallback={<GenerateCourseSuggestionFallback />}>
      <GenerateCourseSuggestionContent params={props.params} />
    </Suspense>
  );
}
