import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { OUTLINE_AHEAD_DAYS, OUTLINE_SOON_DAYS } from "@zoonk/core/lookahead/outline-ahead";
import { type SessionPreparation } from "@zoonk/core/lookahead/session-preparation";
import { getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import { claimRunToken } from "../_shared/run-token";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import {
  listLessonFieldItemTargetsStep,
  prepareFieldItemsStep,
  readGoalField,
} from "../goals/steps/field-items-steps";
import {
  listPlanOutlineNeedsStep,
  listSoonStandInCourseIdsStep,
} from "../goals/steps/goal-lookahead-steps";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { prepareLanguageCallsStep } from "./steps/language-call-steps";
import {
  listLearnerVersionTargetsStep,
  prepareFieldChallengeStep,
  prepareToolVersionStep,
} from "./steps/personal-versions-steps";
import {
  countLessonsBeingWrittenStep,
  listSessionPreparationStep,
} from "./steps/session-preparation-steps";
import { listSkillExtensionsStep } from "./steps/skill-extension-steps";

export type SessionPreparationInput = {
  goalId: string;
  /** The client whose request started the preparation, for analytics. */
  platform?: AnalyticsPlatform | null;
  timeZone: string;
  userId: string;
};

export type SessionPreparationResult =
  | { laterLessonIds: string[]; lessonIds: string[]; status: "prepared" }
  | { status: "alreadyRunning" };

/** A lesson takes one to three minutes to write: the ones this preparation started are checked this often. */
const WRITING_POLL = "15s";
/** Ten minutes of checks: past that, the personal layer is written over whatever is written by then. */
const MAX_WRITING_POLLS = 40;

/**
 * The learner's personal layer over the next lessons, written once and shared: questions set in
 * their field for the skills those lessons teach, each hands-on screen in the tool they chose
 * (or as examples when they install nothing) and the chapter challenge set in their field.
 * Lessons still being written get theirs at the next preparation.
 */
async function preparePersonalLayer({
  analytics,
  goalId,
  lessonIds,
}: {
  analytics: ContentAnalytics;
  goalId: string;
  lessonIds: string[];
}) {
  const { workflowRunId } = getWorkflowMetadata();
  const context = { analytics, workflowRunId };
  const field = await readGoalField({ ...context, goalId });

  const [fieldItems, versions] = await Promise.all([
    field ? listLessonFieldItemTargetsStep({ field, lessonIds }) : [],
    listLearnerVersionTargetsStep({ goalId, lessonIds }),
  ]);

  await Promise.allSettled([
    ...fieldItems.map((target) => prepareFieldItemsStep({ ...context, target })),
    ...versions.tools.map((target) => prepareToolVersionStep({ ...context, target })),
    ...versions.challenges.map((target) => prepareFieldChallengeStep({ ...context, target })),
  ]);
}

/**
 * Starts writing what the learner opens next: each unwritten lesson in its own run (so a lesson
 * page can follow it live), today's next ones at the standard tier since the learner gets there
 * within minutes and the next study day's at the flex tier, and the outlines of skills due soon
 * (the next chapter of a skill a course teaches in part, and the first chapters of one no course
 * teaches yet), at the flex tier too since they're days away, except a course whose stand-ins
 * are due today (`OUTLINE_SOON_DAYS`), a skill's first chapters or its next one: Today holds their
 * time and says more lessons are on the way, so the learner waits on it. It holds the learner's preparation token
 * only while it lists and starts, a second or two, so a session starting right after another
 * preparation is never skipped: a request while one lists is left to it, since it lists the same
 * lessons. Null when another preparation holds the token.
 */
async function startLessonWork({
  analytics,
  input,
}: {
  analytics: ContentAnalytics;
  input: SessionPreparationInput;
}): Promise<SessionPreparation | null> {
  using claim = await claimRunToken(`session-prep:${input.userId}`);

  if (claim.conflict) {
    return null;
  }

  const [preparation, extensions, outlines, soon] = await Promise.all([
    listSessionPreparationStep(input),
    listSkillExtensionsStep(input),
    listPlanOutlineNeedsStep({ days: OUTLINE_AHEAD_DAYS, goalId: input.goalId }),
    listSoonStandInCourseIdsStep({ days: OUTLINE_SOON_DAYS, goalId: input.goalId }),
  ]);

  const { forExam, laterLessonIds, lessonIds } = preparation;
  const soonCourseIds = new Set(soon);

  await Promise.all([
    ...lessonIds.map((lessonId) =>
      start(lessonContentWorkflow, [{ analytics, forExam, lessonId }]),
    ),
    ...laterLessonIds.map((lessonId) =>
      start(lessonContentWorkflow, [{ analytics, forExam, lessonId, wait: "later" }]),
    ),
    ...mergeCourseRequests([...extensions, ...outlines]).map((request) =>
      start(courseOutlineWorkflow, [
        { ...request, analytics, background: !soonCourseIds.has(request.courseId) },
      ]),
    ),
  ]);

  return preparation;
}

type CourseRequest = Awaited<ReturnType<typeof listPlanOutlineNeedsStep>>[number];

/**
 * One outline run per course: a skill's next chapter and another skill's first ones in the same
 * course go together, since a second run for the course would only wait for the first.
 */
function mergeCourseRequests(requests: readonly CourseRequest[]): CourseRequest[] {
  return [...Map.groupBy(requests, (request) => request.courseId).values()].flatMap(
    ([first, ...rest]) =>
      first ? [{ ...first, bands: [...first.bands, ...rest.flatMap((item) => item.bands)] }] : [],
  );
}

/** Waits, with durable sleeps, until the lessons this preparation started are written or given up. */
function waitForWrittenLessons(lessonIds: string[]): Promise<number> {
  if (lessonIds.length === 0) {
    return Promise.resolve(0);
  }

  return repeatUntil({
    done: (writing) => writing === 0,
    run: () => countLessonsBeingWrittenStep(lessonIds),
    times: MAX_WRITING_POLLS,
    wait: () => sleep(WRITING_POLL),
  });
}

/**
 * Once the lessons it started are written, the learner's personal layer over every planned
 * lesson, so the lessons written now have theirs before the learner opens them. One learner's
 * personal layer is written by one preparation at a time: another one writing it covers the same
 * lessons, and the next preparation writes the rest.
 */
async function personalizeLessons({
  analytics,
  input,
  preparation,
}: {
  analytics: ContentAnalytics;
  input: SessionPreparationInput;
  preparation: SessionPreparation;
}) {
  using claim = await claimRunToken(`session-personal:${input.userId}`);

  if (claim.conflict) {
    return;
  }

  await waitForWrittenLessons(preparation.lessonIds);

  await preparePersonalLayer({
    analytics,
    goalId: input.goalId,
    lessonIds: preparation.plannedLessonIds,
  });
}

/**
 * Gets a learner's upcoming lessons ready before they tap them. Every POST that moves a session
 * along starts it (a block starting, a session ending or stopping), never a page view: the next
 * few unwritten lessons of this session are written, and the next study day's first ones, more of
 * both for Plus subscribers (`listSessionPreparation`). A skill whose plan stands in for lessons
 * the Library hasn't outlined, due within two weeks, gets its chapters outlined, so a planned
 * lesson never waits on nothing. Lessons already written or being written are skipped. For a learner with a personal
 * layer, once the lessons it started are written, the planned lessons get their field questions,
 * tool versions and field challenge. A language goal's next checkpoint call
 * and speaking mock are written ahead too, so neither waits on a model when the learner opens it.
 */
export async function sessionPreparationWorkflow(
  input: SessionPreparationInput,
): Promise<SessionPreparationResult> {
  "use workflow";

  const analytics = { distinctId: input.userId, goalId: input.goalId, platform: input.platform };
  const preparation = await startLessonWork({ analytics, input });

  if (!preparation) {
    return { status: "alreadyRunning" };
  }

  // A language goal's next checkpoint call and speaking mock are written alongside, once each.
  await Promise.all([
    preparation.personalized ? personalizeLessons({ analytics, input, preparation }) : null,
    prepareLanguageCallsStep({ goalId: input.goalId, userId: input.userId }).catch(() => null),
  ]);

  return {
    laterLessonIds: preparation.laterLessonIds,
    lessonIds: preparation.lessonIds,
    status: "prepared",
  };
}
