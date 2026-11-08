import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { type GoalOpeningSkill } from "@zoonk/core/library/curriculum/opening-graph";
import { type CurriculumScope } from "@zoonk/core/library/curriculum/scope";
import { sleep } from "workflow";
import { start } from "workflow/api";
import { deliverCourseContent } from "../_shared/course-content-notification";
import { trackGenerationFailedStep } from "../_shared/generation-failed-step";
import { repeatUntil } from "../_shared/repeat-until";
import { claimCourseWhenFree } from "../courses/claim-course-when-free";
import { BUSY_WAIT, MAX_CLAIM_TRIES } from "../courses/course-outline-workflow";
import { finishCourseOutlineStep } from "../courses/steps/course-outline-steps";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { readLessonStatusStep } from "../lessons/steps/read-lesson-status-step";
import { findGoalCourses } from "./goal-courses";
import { type GoalRunContext } from "./goal-run-context";
import { saveGoalSkillsStep } from "./steps/goal-curriculum-steps";
import {
  type OpeningLesson,
  type WrittenOpening,
  findOpeningLessonStep,
  readSavedGoalOpeningStep,
  requestOpeningLessonStep,
  saveGoalOpeningStep,
  saveOpeningChapterStep,
  writeGoalOpeningStep,
} from "./steps/goal-opening-steps";
import { goalProgressStep } from "./steps/goal-progress-step";

const FOLLOW_WAIT = "5s";
const MAX_FOLLOWS = 36;

/** Every model call before the first lesson's run starts is one the learner waits on. */
const LEARNER_TIER = chooseServiceTier({ wait: "learner" });

export type GoalOpening = {
  /**
   * The first skill the graph reads after its chapter is saved: this run's or an earlier run's.
   * Null when there is none, as when writing it failed.
   */
  skill: Promise<GoalOpeningSkill | null>;
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

type Written = { opening: GoalOpeningSkill; written: WrittenOpening };

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
  const { graph, provenance, skill } = written;
  const [course] = graph.courses;

  if (!course) {
    throw new Error("The goal's opening names no course.");
  }

  const [skillIds, courseIds] = await Promise.all([
    saveGoalSkillsStep({
      ...context,
      provenance,
      scope,
      serviceTier: LEARNER_TIER,
      skills: graph.skills,
    }),
    findGoalCourses({
      ...context,
      courses: [course],
      goal: inputs.goal,
      product: inputs.product,
      provenance,
      scope,
      serviceTier: LEARNER_TIER,
    }),
  ]);

  const skillId = skillIds[skill.key];
  const courseId = courseIds[course.key];

  if (!skillId || !courseId) {
    throw new Error("The goal's opening wasn't saved to the Library.");
  }

  return {
    opening: {
      course: { id: courseId, key: course.key, title: course.title },
      skill: {
        area: skill.area,
        description: skill.description,
        estimatedLessons: skill.estimatedLessons,
        id: skillId,
        key: skill.key,
        level: skill.level,
        name: skill.name,
      },
    },
    written,
  };
}

/** Under the course's outline claim, as an outline writes its chapters, so two never write one band at once. */
async function writeOpeningChapter({
  context,
  opening,
  scope,
  userId,
}: {
  context: GoalRunContext;
  opening: Written;
  scope: CurriculumScope;
  userId: string;
}): Promise<string | null> {
  const courseId = opening.opening.course.id;
  const { workflowRunId } = context;

  const claim = await claimCourseWhenFree({
    courseId,
    tries: MAX_CLAIM_TRIES,
    wait: () => sleep(BUSY_WAIT),
    workflowRunId,
  });

  if (!claim.claimed) {
    return null;
  }

  try {
    const lessonId = await deliverCourseContent(
      saveOpeningChapterStep({
        ...context,
        chapter: opening.written.chapter,
        opening: opening.opening,
        provenance: opening.written.provenance,
        scope,
        serviceTier: LEARNER_TIER,
        userId,
      }),
    );

    await deliverCourseContent(
      finishCourseOutlineStep({ courseId, status: "completed", workflowRunId }),
    );

    return lessonId;
  } catch (error) {
    await deliverCourseContent(
      finishCourseOutlineStep({ courseId, status: "failed", workflowRunId }),
    );

    throw error;
  }
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
  const { course, skill } = opening.opening;
  const { id: goalId, userId } = inputs.goal;

  const lessonId =
    (await findOpeningLessonStep({ courseId: course.id, skillId: skill.id, userId })) ??
    (await writeOpeningChapter({ context, opening, scope, userId }));

  return lessonId ? saveGoalOpeningStep({ goalId, lessonId, opening: opening.opening }) : null;
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
 * Picks and saves the learner's first skill, course and lesson, and starts writing the lesson,
 * while the skill graph is written from that first skill. An opening that fails leaves the graph
 * to pick the first lesson, as before.
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
  const known = readSavedGoalOpeningStep(goal.id);

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
      opening ? saveOpeningLesson({ context, inputs, opening, scope }) : (found?.lesson ?? null),
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
    settled: settled.catch(() => null),
    skill: Promise.all([known, written, lesson]).then(([found, opening, saved]) =>
      saved ? (opening?.opening ?? found?.skill ?? null) : null,
    ),
    started: writing.catch(() => null),
  };
}
