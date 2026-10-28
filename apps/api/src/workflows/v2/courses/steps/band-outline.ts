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

export type BandPlan = {
  courseTitle: string;
  level: CourseBandNeed["level"];
  isNewBand: boolean;
  material: string | null;
  nextPosition: number;
  otherChapterTitles: string[];
  skills: GoalSkillRef[];
  extensions: ExtensionPlan[];
  taughtElsewhere: string[];
  withoutTools: boolean;
};

/**
 * A continuation needs a title the course doesn't have: the same title in a course is the same
 * chapter, whose lessons would never be written.
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

export type BandInput = {
  analytics?: ContentAnalytics;
  courseId: string;
  plan: BandPlan;
  scope: CurriculumScope;
  workflowRunId: string;
};

export function toOutlineParams({
  analytics,
  plan,
  scope,
  workflowRunId,
}: Omit<BandInput, "courseId">): CourseOutlineParams {
  const forExam = Boolean(scope.exams?.length);

  return {
    analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
    courseTitle: plan.courseTitle,
    exams: scope.exams,
    extendSkills: plan.extensions.map(({ chapters, lessons, skill }) => ({
      area: forExam ? skill.area : null,
      chapters,
      description: skill.description,
      key: skill.key,
      lessons,
      name: skill.name,
    })),
    language: scope.language,
    level: plan.level,
    material: plan.material ?? undefined,
    model: getScopeModel(scope),
    otherLevelChapters: plan.otherChapterTitles,
    // A course from the learner's material is sized to what fits before their test.
    requiredSkills: plan.skills.map(({ area, description, key, lessons, name }) => ({
      area: forExam ? area : null,
      description,
      key,
      lessons: plan.material ? lessons : undefined,
      name,
    })),
    taughtElsewhere: plan.taughtElsewhere,
    withoutTools: plan.withoutTools,
  };
}
