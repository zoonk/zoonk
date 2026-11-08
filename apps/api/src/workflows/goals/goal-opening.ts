import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type GoalOpeningPin } from "@zoonk/core/library/curriculum/opening-graph";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { sleep } from "workflow";
import { start } from "workflow/api";
import { deliverCourseContent } from "../_shared/course-content-notification";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { repeatUntil } from "../_shared/repeat-until";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { readLessonStatusStep } from "../lessons/steps/read-lesson-status-step";
import { findGoalCourses } from "./goal-courses";
import { type GoalRunContext } from "./goal-run-context";
import { saveGoalSkillsStep } from "./steps/goal-curriculum-steps";
import {
  type OpeningLesson,
  type WrittenOpening,
  readGoalOpeningStep,
  requestOpeningLessonStep,
  saveGoalOpeningStep,
  saveOpeningChapterStep,
  writeGoalOpeningStep,
} from "./steps/goal-opening-steps";
import { goalProgressStep } from "./steps/goal-progress-step";

const FOLLOW_WAIT = "5s";
const MAX_FOLLOWS = 36;

export type GoalOpening = {
  /**
   * The saved first skill and course, once its chapter is saved too. Null when the graph builds
   * without an opening: an earlier run picked it, or writing it failed.
   */
  pin: Promise<GoalOpeningPin | null>;
  /** Settles once the first lesson's run started, or nothing will start one. */
  started: Promise<unknown>;
  /** Settles once the first lesson is ready, or once its run ended without it. */
  settled: Promise<unknown>;
};

/** Exams and languages keep their own fast starts; a course the learner started is already their plan. */
export function hasOpening({
  inputs,
  rebuild,
}: {
  inputs: GoalCurriculumInputs;
  rebuild: boolean;
}): boolean {
  return !rebuild && inputs.goal.kind === "learn" && !inputs.startedCourse;
}

type Written = { pin: GoalOpeningPin; written: WrittenOpening };

async function writeOpening({
  context,
  inputs,
  scope,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
}): Promise<Written> {
  const written = await writeGoalOpeningStep({ ...context, inputs, scope });
  const { graph, provenance } = written;
  const [course] = graph.courses;

  if (!course) {
    throw new Error("The goal's opening names no course.");
  }

  const [skillIds, courseIds] = await Promise.all([
    saveGoalSkillsStep({ ...context, provenance, scope, skills: graph.skills }),
    findGoalCourses({
      ...context,
      courses: [course],
      goal: inputs.goal,
      product: inputs.product,
      provenance,
      scope,
    }),
  ]);

  const skillId = skillIds[written.skill.key];
  const courseId = courseIds[course.key];

  if (!skillId || !courseId) {
    throw new Error("The goal's opening wasn't saved to the Library.");
  }

  return {
    pin: { course: { ...course, id: courseId }, skill: { ...written.skill, libraryId: skillId } },
    written,
  };
}

async function saveOpeningLesson({
  context,
  inputs,
  opening,
  scope,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  opening: Written;
  scope: CurriculumScope;
}): Promise<OpeningLesson | null> {
  const { pin, written } = opening;

  const lessonId = await deliverCourseContent(
    saveOpeningChapterStep({
      ...context,
      chapter: written.chapter,
      courseId: pin.course.id,
      provenance: written.provenance,
      scope,
      skill: { ...written.skill, id: pin.skill.libraryId },
      userId: inputs.goal.userId,
    }),
  );

  return lessonId ? saveGoalOpeningStep({ goalId: inputs.goal.id, lessonId }) : null;
}

async function followLesson(lessonId: string): Promise<boolean> {
  const status = await repeatUntil({
    done: (current) => current !== "generating",
    run: async () => {
      await sleep(FOLLOW_WAIT);
      return readLessonStatusStep(lessonId);
    },
    times: MAX_FOLLOWS,
  });

  return status === "ready";
}

/** The goal's run goes on into the lesson's, so no follow-up is owed for it. */
async function writeOpeningLesson({
  context,
  goalId,
  lesson,
  userId,
}: {
  context: GoalRunContext;
  goalId: string;
  lesson: OpeningLesson;
  userId: string;
}): Promise<() => Promise<boolean>> {
  await goalProgressStep({
    entityId: goalId,
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    status: "started",
    step: "writeFirstLesson",
  });

  const request = await requestOpeningLessonStep({
    analytics: context.analytics,
    lessonId: lesson.id,
    userId,
  });

  if (request.status === "start") {
    // A lesson run claims the lesson's token itself, as a plan's do, and a duplicate ends busy.
    const run = await start(lessonContentWorkflow, [request.input]);

    return async () => {
      const result = await run.returnValue;
      return result.status === "busy" ? followLesson(lesson.id) : result.status === "ready";
    };
  }

  if (request.status === "generating") {
    return () => followLesson(lesson.id);
  }

  return async () => request.status === "ready";
}

async function reportReady({
  goalId,
  lessonId,
  ready,
}: {
  goalId: string;
  lessonId: string;
  ready: () => Promise<boolean>;
}): Promise<void> {
  if (await ready()) {
    await goalProgressStep({
      entityId: goalId,
      lessonId,
      status: "completed",
      step: "firstLessonReady",
    });
  }
}

/**
 * Picks and saves the learner's first lesson and starts writing it while the skill graph is
 * written, pinned to it. An opening that fails leaves the graph to pick the first lesson, as
 * before.
 */
export function openGoal({
  context,
  inputs,
  scope,
}: {
  context: GoalRunContext;
  inputs: GoalCurriculumInputs;
  scope: CurriculumScope;
}): GoalOpening {
  const { goal } = inputs;
  const known = readGoalOpeningStep(goal.id);

  const failed = async () => {
    await trackGenerationFailedStep({
      analytics: context.analytics,
      contentKind: "curriculum",
      task: "goal-opening",
    });

    return null;
  };

  const written = known
    .then((found) => (found ? null : writeOpening({ context, inputs, scope })))
    .catch(failed);

  const lesson = Promise.all([known, written])
    .then(([found, opening]) =>
      opening ? saveOpeningLesson({ context, inputs, opening, scope }) : found,
    )
    .catch(failed);

  const writing = lesson.then((saved) =>
    saved
      ? writeOpeningLesson({ context, goalId: goal.id, lesson: saved, userId: goal.userId })
      : null,
  );

  const settled = Promise.all([lesson, writing]).then(([saved, ready]) =>
    saved && ready ? reportReady({ goalId: goal.id, lessonId: saved.id, ready }) : null,
  );

  return {
    // Once its chapter is saved too, so the plan built from the pinned graph finds its lessons.
    pin: Promise.all([written, lesson]).then(([opening]) => opening?.pin ?? null),
    settled: settled.catch(() => null),
    started: writing.catch(() => null),
  };
}
