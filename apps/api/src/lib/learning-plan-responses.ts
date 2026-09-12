import { type getCourseLearningPath } from "@zoonk/core/courses/learning-plan";
import { type CourseLearningPlan } from "@zoonk/db";
import { toChapterLesson, toChapterResource } from "./catalog-responses";

export function toLearningPlan(plan: CourseLearningPlan | null) {
  if (!plan) {
    return null;
  }

  return {
    chapterIds: plan.chapterIds,
    contentRevision: plan.contentRevision,
    courseId: plan.courseId,
    dailyMinutes: plan.dailyMinutes,
    depth: plan.depth,
    goal: plan.goal,
    hiddenLessonKinds: plan.hiddenLessonKinds,
    id: plan.id,
    revision: plan.revision,
    startingKnowledge: plan.startingKnowledge,
    startingLevel: plan.startingLevel,
    summary: plan.summary,
  };
}

type ReadyPath = Extract<Awaited<ReturnType<typeof getCourseLearningPath>>, { status: "ready" }>;

export function toLearningPath(result: ReadyPath) {
  return {
    chapters: result.chapters.map((chapter) => ({
      ...toChapterResource(chapter),
      completedLessons: chapter.completedLessons,
      isCompleted: chapter.isCompleted,
      lessons: chapter.lessons.map((lesson) => ({
        ...toChapterLesson({ courseId: chapter.courseId, lesson }),
        isCompleted: lesson.isCompleted,
      })),
      totalLessons: chapter.totalLessons,
    })),
    needsCurriculumUpdate: result.needsCurriculumUpdate,
    needsPlan: result.needsPlan,
    nextTarget: result.nextTarget,
    plan: toLearningPlan(result.plan),
    progress: result.progress,
    status: result.status,
    supportsLearningPlan: result.supportsLearningPlan,
  };
}
