import { type ServedSpeed } from "@zoonk/ai/provider-options";
import {
  type CourseContentWrite,
  collectCourseContentTags,
} from "@zoonk/core/cache/course-content";
import {
  findOpeningLesson,
  readGoalOpeningLesson,
  saveGoalOpening,
} from "@zoonk/core/goals/opening";
import { getCourseBandContext } from "@zoonk/core/library/curriculum/course-outline-state";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { writeGoalOpening } from "@zoonk/core/library/curriculum/goal-opening";
import {
  type OutlineChapter,
  saveOutlineChapter,
} from "@zoonk/core/library/curriculum/save-outline-chapter";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { requestLessonGenerationFor } from "@zoonk/core/lookahead/request-lesson-generation";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { type LessonContentInput } from "../../lessons/lesson-content-workflow";
import { requestLiveLessonWriting } from "../../lessons/lesson-writing-request";

type RunScope = { analytics?: ContentAnalytics; workflowRunId: string };

export type WrittenOpening = Awaited<ReturnType<typeof writeGoalOpening>>;

export type OpeningLesson = { id: string; title: string };

export async function readGoalOpeningStep(goalId: string): Promise<OpeningLesson | null> {
  "use step";

  return readGoalOpeningLesson(goalId);
}

export async function writeGoalOpeningStep({
  analytics,
  inputs,
  scope,
  workflowRunId,
}: RunScope & { inputs: GoalCurriculumInputs; scope: CurriculumScope }): Promise<WrittenOpening> {
  "use step";

  return writeGoalOpening({
    analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
    inputs,
    scope,
  });
}

/** A course that already teaches the skill gives its first lesson; otherwise the opening's chapter is written into the skill's band. */
export async function saveOpeningChapterStep({
  analytics,
  chapter,
  courseId,
  provenance,
  scope,
  skill,
  userId,
  workflowRunId,
}: RunScope & {
  chapter: OutlineChapter;
  courseId: string;
  provenance: WrittenOpening["provenance"];
  scope: CurriculumScope;
  skill: WrittenOpening["skill"] & { id: string };
  userId: string;
}): Promise<CourseContentWrite<string | null>> {
  "use step";

  return collectCourseContentTags(async () => {
    const taught = await findOpeningLesson({ courseId, skillId: skill.id, userId });

    if (taught) {
      return taught;
    }

    const band = await getCourseBandContext({ courseId, level: skill.level });

    const saved = await saveOutlineChapter({
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      chapter,
      courseId,
      goalSkills: [skill],
      level: skill.level,
      position: band.nextPosition,
      provenance,
      scope,
      workflowRunId,
    });

    return saved.lessonIds[0] ?? null;
  });
}

export async function saveGoalOpeningStep(input: {
  goalId: string;
  lessonId: string;
}): Promise<OpeningLesson | null> {
  "use step";

  return saveGoalOpening(input);
}

export type OpeningLessonRequest =
  | { input: LessonContentInput; status: "start" }
  | { status: "generating" | "other" | "ready" };

/** The learner's lesson start admits it, so the goal's run writes it only as their own start would. */
export async function requestOpeningLessonStep({
  analytics,
  lessonId,
  userId,
}: {
  analytics?: ContentAnalytics;
  lessonId: string;
  userId: string;
}): Promise<OpeningLessonRequest> {
  "use step";

  const writing = await requestLiveLessonWriting({
    lessonId,
    request: () => requestLessonGenerationFor({ lessonId, userId }),
  });

  if (writing.status !== "start") {
    return {
      status:
        writing.status === "ready" || writing.status === "generating" ? writing.status : "other",
    };
  }

  const speed: ServedSpeed = "fast";

  return {
    input: {
      analytics: { ...writing.analytics, ...analytics },
      forExam: writing.forExam,
      lessonId,
      speed,
      wait: "learner",
    },
    status: "start",
  };
}
