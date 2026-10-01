import { RelaunchNotice } from "@/components/waitlist/relaunch-notice";
import { IS_RELAUNCH_WAITLIST_ENABLED } from "@zoonk/utils/relaunch";
import { Suspense } from "react";
import { GenerateCourseContent, GenerateCourseFallback } from "./generate-course-content";

export const prefetch = "force-disabled";

export default function GenerateCoursePage(props: PageProps<"/[lang]/generate/c/[slug]">) {
  if (IS_RELAUNCH_WAITLIST_ENABLED) {
    return <RelaunchNotice />;
  }

  return (
    <Suspense fallback={<GenerateCourseFallback />}>
      <GenerateCourseContent params={props.params} />
    </Suspense>
  );
}
