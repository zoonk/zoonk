import {
  type CourseOutlineParams,
  type generateCourseOutline,
} from "@zoonk/ai/tasks/v2/curriculum/course-outline";
import {
  type CourseOutline,
  type OutlineChapter,
} from "@zoonk/core/library/curriculum/save-outline-chapter";
import {
  type CourseBandNeed,
  type CurriculumScope,
  type GoalSkillRef,
  getScopeModel,
} from "@zoonk/core/library/curriculum/scope";
import { type ExtensionPlan } from "@zoonk/core/library/curriculum/skill-extensions";
import { normalizeString } from "@zoonk/utils/string";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

export type OutlineProvenance = Awaited<ReturnType<typeof generateCourseOutline>>["provenance"];

/**
 * A level band this run writes: the goal skills the course doesn't teach yet, the skills it teaches
 * in part, and where new chapters go.
 */
export type BandPlan = {
  courseTitle: string;
  level: CourseBandNeed["level"];
  /** The band has no chapters yet, so its whole outline is written for every learner. */
  isNewBand: boolean;
  nextPosition: number;
  otherChapterTitles: string[];
  skills: GoalSkillRef[];
  /** Skills the band teaches in part, each getting its next chapter in this run. */
  extensions: ExtensionPlan[];
  /** The band's skills other chapters of this course already teach: the outline mustn't repeat them. */
  taughtElsewhere: string[];
};

/**
 * The next chapters of skills the band teaches in part: one per skill a run, under a title the
 * course doesn't have yet, since the same title in the same course is the same chapter and its
 * lessons would never be written.
 */
function pickContinuations({
  chapters,
  plan,
}: {
  chapters: readonly OutlineChapter[];
  plan: BandPlan;
}): OutlineChapter[] {
  const titles = new Set(plan.otherChapterTitles.map((title) => normalizeString(title)));

  return chapters
    .filter((chapter) => !titles.has(normalizeString(chapter.title)))
    .slice(0, plan.extensions.length);
}

/**
 * A band that already has chapters only gains the chapters that teach the missing skills, and the
 * next chapter of each skill it teaches in part; the rest of a new outline would repeat what the
 * band covers.
 */
export function pickChapters({
  outline,
  plan,
}: {
  outline: CourseOutline;
  plan: BandPlan;
}): OutlineChapter[] {
  if (plan.isNewBand) {
    return outline.chapters;
  }

  const extended = new Set(plan.extensions.map((extension) => extension.skill.key));

  const isContinuation = (chapter: OutlineChapter) =>
    chapter.skillKeys.some((key) => extended.has(key));

  const continuations = pickContinuations({
    chapters: outline.chapters.filter((chapter) => isContinuation(chapter)),
    plan,
  });

  return outline.chapters.filter(
    (chapter) =>
      continuations.includes(chapter) || (!isContinuation(chapter) && chapter.skillKeys.length > 0),
  );
}

/** What writing a band's outline reads: the run's context and the band's plan. */
export type BandInput = {
  analytics?: ContentAnalytics;
  courseId: string;
  plan: BandPlan;
  scope: CurriculumScope;
  workflowRunId: string;
};

/** The outline writer's input for a band, the same whether it's streamed or not. */
export function toOutlineParams({
  analytics,
  plan,
  scope,
  workflowRunId,
}: Omit<BandInput, "courseId">): CourseOutlineParams {
  return {
    analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
    courseTitle: plan.courseTitle,
    extendSkills: plan.extensions.map(({ chapters, lessons, skill }) => ({
      chapters,
      description: skill.description,
      key: skill.key,
      lessons,
      name: skill.name,
    })),
    language: scope.language,
    level: plan.level,
    model: getScopeModel(scope),
    otherLevelChapters: plan.otherChapterTitles,
    requiredSkills: plan.skills.map(({ description, key, name }) => ({ description, key, name })),
    taughtElsewhere: plan.taughtElsewhere,
  };
}
