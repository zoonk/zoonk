import { RelaunchNotice } from "@/components/waitlist/relaunch-notice";
import { IS_RELAUNCH_WAITLIST_ENABLED } from "@zoonk/utils/relaunch";
import { Suspense } from "react";
import {
  GenerateCoursePromptContent,
  GenerateCoursePromptFallback,
} from "./generate-course-prompt-content";

export const prefetch = "force-disabled";

export default function GenerateCoursePage(props: PageProps<"/[lang]/generate/course/[id]">) {
  if (IS_RELAUNCH_WAITLIST_ENABLED) {
    return <RelaunchNotice />;
  }

  return (
    <Suspense fallback={<GenerateCoursePromptFallback />}>
      <GenerateCoursePromptContent params={props.params} />
    </Suspense>
  );
}
