import { generateCourseOutline } from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import {
  type MissingCourseBands,
  findLessonSkillIds,
  findMissingCourseBands,
} from "@zoonk/core/library/curriculum/course-outline-state";
import { replanGoalsWaitingOnSkills } from "@zoonk/core/library/curriculum/replan-waiting-goals";
import { type OutlineChapter } from "@zoonk/core/library/curriculum/save-outline-chapter";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics } from "../../_shared/content-analytics";
import { type BandPlan, type OutlineProvenance, toOutlineParams } from "./band-outline";

/** One band's outline, written whole, ready to save like any band's. */
export type RemainingBandOutline = {
  chapters: OutlineChapter[];
  level: BandPlan["level"];
  provenance: OutlineProvenance;
};

/** The level bands of a shared course that have no chapters yet; null when none is missing. */
export async function findMissingBandsStep(courseId: string): Promise<MissingCourseBands | null> {
  "use step";

  return findMissingCourseBands(courseId);
}

/** A band nobody needs yet is written whole: no goal skills, so it covers its level for everyone. */
function toWholeBandPlan({
  level,
  missing,
}: {
  level: BandPlan["level"];
  missing: MissingCourseBands;
}): BandPlan {
  return {
    courseTitle: missing.courseTitle,
    extensions: [],
    isNewBand: true,
    level,
    nextPosition: 0,
    otherChapterTitles: missing.chapterTitles,
    skills: [],
    taughtElsewhere: [],
  };
}

/**
 * Writes one missing band's outline with the regular outline writer at the flex tier: nobody waits
 * on it, so it's answered best effort at about half the price.
 */
export async function writeRemainingBandStep({
  analytics,
  level,
  missing,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  level: BandPlan["level"];
  missing: MissingCourseBands;
  workflowRunId: string;
}): Promise<RemainingBandOutline> {
  "use step";

  const plan = toWholeBandPlan({ level, missing });

  const { data, provenance } = await withAiRetry(() =>
    generateCourseOutline({
      ...toOutlineParams({ analytics, plan, scope: missing.scope, workflowRunId }),
      serviceTier: "flex",
    }),
  );

  return { chapters: data.chapters, level, provenance };
}

/**
 * A band written whole has no goal skills, but identity search can give its lessons skills some
 * goal still waits on: those goals now plan the real lessons instead of stand-ins.
 */
export async function replanGoalsForLessonsStep(lessonIds: string[]): Promise<string[]> {
  "use step";

  const skillIds = await findLessonSkillIds(lessonIds);
  return replanGoalsWaitingOnSkills({ skillIds });
}
