import { type AnalyticsPlatform } from "@zoonk/core/analytics/shared-properties";
import { type SessionPreparation } from "@zoonk/core/lookahead/session-preparation";
import { createHook, getWorkflowMetadata, sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import { courseOutlineWorkflow } from "../courses/course-outline-workflow";
import {
  listLessonFieldItemTargetsStep,
  prepareFieldItemsStep,
  readGoalField,
} from "../goals/steps/field-items-steps";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { lessonSpecsWorkflow } from "../lessons/lesson-specs-workflow";
import {
  listDeeperVersionTargetsStep,
  prepareDeeperVersionStep,
} from "./steps/deeper-versions-steps";
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
  | { lessonIds: string[]; specLessonIds: string[]; status: "prepared" }
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
 * For a learner whose lessons open the "Go deeper" version first, those versions of the next
 * lessons' explanations are written ahead, shared with everyone.
 */
async function prepareDeeperVersions({
  analytics,
  lessonIds,
  userId,
}: {
  analytics: ContentAnalytics;
  lessonIds: string[];
  userId: string;
}) {
  const { workflowRunId } = getWorkflowMetadata();
  const targets = await listDeeperVersionTargetsStep({ lessonIds, userId });

  await Promise.allSettled(
    targets.map((target) => prepareDeeperVersionStep({ analytics, target, workflowRunId })),
  );
}

/**
 * Starts writing what the learner opens next: each unwritten lesson in its own run (so a lesson
 * page can follow it live), today's next one at the priority tier since the learner gets there
 * within minutes, the next chapter's specs and the outlines of skills due soon. It holds
 * the learner's preparation token only while it lists and starts, a second or two, so a session
 * starting right after another preparation is never skipped: a request while one lists is left to
 * it, since it lists the same lessons. Null when another preparation holds the token.
 */
async function startLessonWork({
  analytics,
  input,
}: {
  analytics: ContentAnalytics;
  input: SessionPreparationInput;
}): Promise<SessionPreparation | null> {
  using hook = createHook({ token: `session-prep:${input.userId}` });

  if (await hook.getConflict()) {
    return null;
  }

  const [preparation, extensions] = await Promise.all([
    listSessionPreparationStep(input),
    listSkillExtensionsStep(input),
  ]);

  const { forExam, lessonIds, specLessonIds, urgentLessonId } = preparation;

  await Promise.all([
    ...lessonIds.map((lessonId) =>
      start(lessonContentWorkflow, [
        { analytics, forExam, lessonId, ...(lessonId === urgentLessonId && { priority: true }) },
      ]),
    ),
    specLessonIds.length > 0
      ? start(lessonSpecsWorkflow, [{ analytics, lessonIds: specLessonIds }])
      : null,
    ...extensions.map((request) => start(courseOutlineWorkflow, [{ ...request, analytics }])),
  ]);

  return preparation;
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
 * Once the lessons it started are written, the learner's personal layer and "Go deeper" versions
 * over every planned lesson, so the lessons written now have theirs before the learner opens
 * them. One learner's personal layer is written by one preparation at a time: another one writing
 * it covers the same lessons, and the next preparation writes the rest.
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
  using hook = createHook({ token: `session-personal:${input.userId}` });

  if (await hook.getConflict()) {
    return;
  }

  await waitForWrittenLessons(preparation.lessonIds);

  await Promise.all([
    preparePersonalLayer({
      analytics,
      goalId: input.goalId,
      lessonIds: preparation.plannedLessonIds,
    }),
    prepareDeeperVersions({
      analytics,
      lessonIds: preparation.plannedLessonIds,
      userId: input.userId,
    }),
  ]);
}

/**
 * Gets a learner's upcoming lessons ready before they tap them. Every POST that moves a session
 * along starts it (a block starting, a session ending or stopping), never a page view: every
 * unwritten lesson of this session and the next study day is written, and the chapter after the
 * one being studied gets its specs. A skill whose plan stands in for lessons the Library hasn't
 * outlined, due within two weeks, gets its next chapter outlined, so a planned lesson never waits
 * on nothing. Lessons already written or being written are skipped. For a learner with a personal
 * layer, once the lessons it started are written, the planned lessons get their field questions,
 * tool versions, field challenge and "Go deeper" versions. A language goal's next checkpoint call
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
    lessonIds: preparation.lessonIds,
    specLessonIds: preparation.specLessonIds,
    status: "prepared",
  };
}
