import { type ServedSpeed, type ServiceTier } from "@zoonk/ai/provider-options";
import {
  type CourseContentWrite,
  collectCourseContentTags,
} from "@zoonk/core/cache/course-content";
import {
  type SavedGoalOpening,
  findOpeningLesson,
  readSavedGoalOpening,
  saveGoalOpening,
} from "@zoonk/core/goals/opening";
import { getCourseBandContext } from "@zoonk/core/library/curriculum/course-outline-state";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { writeGoalOpening } from "@zoonk/core/library/curriculum/goal-opening";
import { type GoalOpeningSkill } from "@zoonk/core/library/curriculum/opening-graph";
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

export type OpeningLesson = SavedGoalOpening["lesson"];

export async function readSavedGoalOpeningStep(goalId: string): Promise<SavedGoalOpening | null> {
  "use step";

  return readSavedGoalOpening(goalId);
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

export async function findOpeningLessonStep(input: {
  courseId: string;
  skillId: string;
  userId: string;
}): Promise<string | null> {
  "use step";

  return findOpeningLesson(input);
}

/**
 * The caller holds the course's outline claim. A run the claim waited on may have taught the skill
 * meanwhile, so its first lesson is taken before a chapter is written into the skill's band.
 */
export async function saveOpeningChapterStep({
  analytics,
  chapter,
  opening,
  provenance,
  scope,
  serviceTier,
  userId,
  workflowRunId,
}: RunScope & {
  chapter: OutlineChapter;
  opening: GoalOpeningSkill;
  provenance: WrittenOpening["provenance"];
  scope: CurriculumScope;
  serviceTier?: ServiceTier;
  userId: string;
}): Promise<CourseContentWrite<string | null>> {
  "use step";

  const { course, skill } = opening;

  return collectCourseContentTags(async () => {
    const taught = await findOpeningLesson({ courseId: course.id, skillId: skill.id, userId });

    if (taught) {
      return taught;
    }

    const band = await getCourseBandContext({ courseId: course.id, level: skill.level });

    const saved = await saveOutlineChapter({
      analytics: toContentAnalytics({ analytics, scope, workflowRunId }),
      chapter,
      courseId: course.id,
      goalSkills: [skill],
      level: skill.level,
      position: band.nextPosition,
      provenance,
      scope,
      serviceTier,
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
