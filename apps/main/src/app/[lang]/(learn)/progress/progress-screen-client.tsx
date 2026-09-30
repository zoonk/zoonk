"use client";

import { useGoToStudyDestination } from "@/lib/session/use-study-navigation";
import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { type AreaPracticeOutcome, ProgressScreen } from "@zoonk/learn/progress";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { practiceAreaAction } from "./practice-area-action";

/** Where Progress links; the language goal's Progress links to the same pages. */
export const PROGRESS_HREFS = {
  activity: "/activity",
  energy: "/energy",
  exam: "/exam",
  level: "/level",
  mistakes: "/mistakes",
  patterns: "/patterns",
  score: "/score",
};

/** Progress with "Practice now" wired to today's session in the learner's timezone. */
export function ProgressScreenClient({ progress }: { progress: ProgressView }) {
  const go = useGoToStudyDestination();

  const practiceArea = async (areaId: string): Promise<AreaPracticeOutcome> => {
    const result = await practiceAreaAction(progress.goal.id, {
      areaId,
      timeZone: getLocalTimeZone(),
    });

    if (result.outcome === "started") {
      await go(result.destination);
    }

    return result.outcome;
  };

  return <ProgressScreen actions={{ practiceArea }} hrefs={PROGRESS_HREFS} progress={progress} />;
}
