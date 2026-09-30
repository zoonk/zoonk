import { generateCourseOutline } from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import {
  claimCourseOutline,
  findUntaughtSkills,
  finishCourseOutline,
  getCourseBandContext,
  getCourseOutlineOwner,
  releaseStaleCourseOutline,
} from "@zoonk/core/library/curriculum/course-outline-state";
import { placeContinuations } from "@zoonk/core/library/curriculum/place-continuations";
import { replanGoalsWaitingOnSkills } from "@zoonk/core/library/curriculum/replan-waiting-goals";
import {
  type OutlineChapter,
  type SavedOutlineChapter,
  saveOutlineChapter,
} from "@zoonk/core/library/curriculum/save-outline-chapter";
import {
  type CourseBandNeed,
  type CurriculumScope,
  type GoalSkillRef,
} from "@zoonk/core/library/curriculum/scope";
import { planSkillExtensions } from "@zoonk/core/library/curriculum/skill-extensions";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { isRunActive } from "../../_shared/run-activity";
import {
  type BandInput,
  type BandPlan,
  type OutlineProvenance,
  pickChapters,
  toOutlineParams,
} from "./band-outline";
import { type BandOutline, writeWaitedBand } from "./waited-band-outline";

type OutlineContext = {
  analytics?: ContentAnalytics;
  courseId: string;
  scope: CurriculumScope;
  workflowRunId: string;
};

/**
 * Decides what a band still needs. Skills the course already teaches (in any band) are planned from
 * its lessons; a band whose skills are all taught needs nothing, even when it has no chapters here.
 * Another course's lessons never count: a course on the same subject shares its chapters and
 * lessons through identity search when the outline asks for them. A band requested without skills
 * is written whole when the course doesn't have it yet. A skill the band teaches in part (`extend`)
 * gets its next chapter while the course still has fewer of its lessons than the goal needs.
 */
export async function planOutlineBandStep({
  band,
  courseId,
  scope,
}: {
  band: CourseBandNeed;
  courseId: string;
  scope: CurriculumScope;
}): Promise<BandPlan | null> {
  "use step";

  const [untaught, context, extensions] = await Promise.all([
    findUntaughtSkills({
      courseId,
      ownerId: scope.ownerId,
      skillIds: band.skills.map((skill) => skill.id),
    }),
    getCourseBandContext({ courseId, level: band.level }),
    planSkillExtensions({ courseId, extensions: band.extend ?? [], ownerId: scope.ownerId }),
  ]);

  const extended = extensions.filter((extension) => extension.level === band.level);

  // A band asked for without skills (an Overview course for "Want to go further?") is written whole once.
  const wantsWholeBand =
    band.skills.length === 0 && !band.extend?.length && context.nextPosition === 0;

  if (untaught.length === 0 && !wantsWholeBand && extended.length === 0) {
    return null;
  }

  return {
    courseTitle: context.title,
    extensions: extended,
    isNewBand: context.nextPosition === 0,
    level: band.level,
    nextPosition: context.nextPosition,
    otherChapterTitles: context.chapterTitles,
    skills: band.skills.filter((skill) => untaught.includes(skill.id)),
    taughtElsewhere: band.skills
      .filter((skill) => !untaught.includes(skill.id))
      .map((skill) => skill.name),
  };
}

/** Claims the course's outline; a claim left by a run that stopped is taken over. */
export async function claimCourseOutlineStep(input: { courseId: string; workflowRunId: string }) {
  "use step";

  const claim = await claimCourseOutline(input);
  const ownerId = claim === "running" ? await getCourseOutlineOwner(input.courseId) : null;

  if (!ownerId || (await isRunActive(ownerId))) {
    return claim;
  }

  await releaseStaleCourseOutline({ courseId: input.courseId, staleRunId: ownerId });

  return claimCourseOutline(input);
}

export async function finishCourseOutlineStep(input: {
  courseId: string;
  status: "completed" | "failed";
  workflowRunId: string;
}): Promise<void> {
  "use step";

  await finishCourseOutline(input);
}

/**
 * Writes one level band's outline: chapters with objectives, and every lesson's title and skills.
 * The band teaching the skill of a waiting learner's first lesson is written at the priority tier
 * and, unless it continues chapters the band already has, streamed, so the chapter teaching that
 * skill is saved before the rest is written.
 */
export async function writeOutlineBandStep({
  waitedSkillId,
  ...input
}: BandInput & { waitedSkillId?: string }): Promise<BandOutline> {
  "use step";

  const { plan } = input;
  const waitedKey = plan.skills.find((skill) => skill.id === waitedSkillId)?.key;

  if (waitedKey && plan.extensions.length === 0) {
    return withAiRetry(() => writeWaitedBand({ input, waitedKey }));
  }

  const { data, provenance } = await withAiRetry(() =>
    generateCourseOutline({
      ...toOutlineParams(input),
      serviceTier: waitedKey ? "priority" : undefined,
    }),
  );

  return { chapters: pickChapters({ outline: data, plan }), early: null, provenance };
}

/** One chapter per step, so a chapter that fails retries alone. */
export async function saveOutlineChapterStep({
  analytics,
  chapter,
  courseId,
  goalSkills,
  level,
  position,
  provenance,
  scope,
  workflowRunId,
}: OutlineContext & {
  chapter: OutlineChapter;
  goalSkills: GoalSkillRef[];
  level: CourseBandNeed["level"];
  position: number;
  provenance: OutlineProvenance;
}): Promise<SavedOutlineChapter> {
  "use step";

  return withAiRetry(() =>
    saveOutlineChapter({
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      chapter,
      courseId,
      goalSkills,
      level,
      position,
      provenance,
      scope,
      workflowRunId,
    }),
  );
}

/**
 * Moves each continuation right after the last chapter of the skill it continues, so the course
 * keeps its teaching order (in math, what builds on a topic stays after it). Chapters written for
 * skills the band lacked stay where they were added.
 */
export async function placeContinuationsStep({
  chapterIds,
  chapters,
  courseId,
  plan,
}: {
  chapterIds: string[];
  chapters: OutlineChapter[];
  courseId: string;
  plan: BandPlan;
}): Promise<void> {
  "use step";

  const moves = chapters.flatMap((chapter, index) => {
    const extension = plan.extensions.find((item) => chapter.skillKeys.includes(item.skill.key));
    const chapterId = chapterIds[index];

    return extension && chapterId ? [{ afterChapterId: extension.afterChapterId, chapterId }] : [];
  });

  await placeContinuations({ courseId, level: plan.level, moves });
}

/**
 * Goals waiting on these skills (any learner's) now plan the real lessons instead of stand-ins,
 * and goals re-planned from the band's first chapter plan the whole band.
 */
export async function replanWaitingGoalsStep(input: {
  goalIds: string[];
  skillIds: string[];
}): Promise<string[]> {
  "use step";

  return replanGoalsWaitingOnSkills(input);
}
