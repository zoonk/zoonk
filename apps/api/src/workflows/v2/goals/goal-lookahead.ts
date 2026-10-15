import { type CallWait } from "@zoonk/ai/provider-options";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import {
  admitPlanLessonsStep,
  pickPlanStartToWriteStep,
  pickSpeculativeLessonsStep,
  readGoalLookaheadStep,
  readPlanOpeningStep,
} from "./steps/goal-lookahead-steps";

/** The first outline band takes about a minute; placement runs meanwhile. */
const OUTLINE_POLL = "5s";
const MAX_OUTLINE_POLLS = 48;
/** How long the plan's start is followed after the first lessons start: placement and the last bands. */
const FOLLOW_POLLS = 60;

type PlanOpening = (string | null)[];

/** Where the saved plan started at the last look (`undefined` before the first), and what started. */
type Followed = { saved: string | null | undefined; started: string[] };

function hasFirstLesson(opening: PlanOpening): boolean {
  return typeof opening[0] === "string";
}

/**
 * A chapter found in the Library can land before the band the learner reaches first, so one real
 * lesson isn't enough: every lesson of the opening must be.
 */
function isOpeningOutlined(opening: PlanOpening): boolean {
  return opening.length > 0 && opening.every((lessonId) => lessonId !== null);
}

function waitForOpening({
  done,
  goalId,
}: {
  done: (opening: PlanOpening) => boolean;
  goalId: string;
}): Promise<PlanOpening> {
  return repeatUntil({
    done,
    run: () => readPlanOpeningStep(goalId),
    times: MAX_OUTLINE_POLLS,
    wait: () => sleep(OUTLINE_POLL),
  });
}

type LessonWriter = { analytics: ContentAnalytics; forExam: boolean };

function toWriter({
  context,
  inputs,
}: {
  context: { analytics: ContentAnalytics };
  inputs: GoalCurriculumInputs;
}): LessonWriter {
  return { analytics: context.analytics, forExam: inputs.goal.kind === "exam" };
}

/**
 * Starts writing the lessons the plan still has the learner do (see `admitPlanLessonsStep`), and
 * returns them: `learner` for the plan's first lesson, which the learner opens the moment
 * placement ends; the others are minutes away.
 */
async function writeLessons({
  goalId,
  lessonIds,
  wait = "soon",
  writer,
}: {
  goalId: string;
  lessonIds: string[];
  wait?: CallWait;
  writer: LessonWriter;
}): Promise<string[]> {
  const admitted =
    lessonIds.length > 0 ? await admitPlanLessonsStep({ goalId, lessonIds }) : lessonIds;

  await Promise.all(
    admitted.map((lessonId) => start(lessonContentWorkflow, [{ ...writer, lessonId, wait }])),
  );

  return admitted;
}

/**
 * While placement runs, the first lessons of the two likeliest starting phases start generating,
 * so the first lesson is ready when placement ends: two for a free learner, four for a Plus
 * subscriber (`getLookahead`), whose sessions run longer. The plan's first lesson starts the
 * moment its band lands, since the learner opens it next; the rest follow once the whole opening
 * is outlined, the first lesson of the other guessed phase first, since placement may start the
 * learner there. Guests never trigger speculative work.
 */
export async function startLikelyLessons({
  context,
  inputs,
}: {
  context: { analytics: ContentAnalytics };
  inputs: GoalCurriculumInputs;
}): Promise<string[]> {
  const goalId = inputs.goal.id;
  const writer = toWriter({ context, inputs });
  const ownLevel = inputs.graphPrompt.ownLevel ?? null;

  if (inputs.isGuest) {
    return [];
  }

  const { speculativeLessons: count } = await readGoalLookaheadStep(goalId);
  const pick = () => pickSpeculativeLessonsStep({ count, goalId, ownLevel });

  await waitForOpening({ done: hasFirstLesson, goalId });
  const [firstGuess = []] = await pick();

  const first = await writeLessons({
    goalId,
    lessonIds: firstGuess.slice(0, 1),
    wait: "learner",
    writer,
  });

  await waitForOpening({ done: isOpeningOutlined, goalId });
  const guesses = await pick();

  const unstarted = guesses.map((guess) => guess.filter((lessonId) => !first.includes(lessonId)));

  const leads = unstarted.slice(1).flatMap((guess) => guess.slice(0, 1));
  const rest = unstarted.flat().filter((lessonId) => !leads.includes(lessonId));

  const started = await writeLessons({ goalId, lessonIds: [...leads, ...rest], writer });

  return [...first, ...started];
}

/**
 * The plan's start still moves after its first lessons start: placement moves the learner past
 * what they know, and each band that lands re-plans with its real lessons. For a few minutes, the
 * plan's first lesson is written the moment the start moves to one nobody started, so it's ready
 * when the learner opens it; one already written ends its run at once. The learner's own lesson
 * waits until placement ends (`pickPlanStartToWrite`). Each look reads where the saved plan
 * starts, and only a start that moved is picked again, from the plan brought up to date: a plan
 * still waiting for a band's lessons never sends the writer to the lesson before them. Guests
 * never trigger speculative work.
 */
export async function followPlanStart({
  context,
  inputs,
  started,
}: {
  context: { analytics: ContentAnalytics };
  inputs: GoalCurriculumInputs;
  started: string[];
}): Promise<void> {
  if (inputs.isGuest) {
    return;
  }

  const writer = toWriter({ context, inputs });

  const initial: Followed = { saved: undefined, started };

  await repeatUntil<Followed>({
    done: () => false,
    run: async (previous = initial) => {
      const [saved = null] = await readPlanOpeningStep(inputs.goal.id);

      if (saved === previous.saved) {
        return previous;
      }

      const first = await pickPlanStartToWriteStep(inputs.goal.id);

      if (!first || previous.started.includes(first)) {
        return { saved, started: previous.started };
      }

      const written = await writeLessons({
        goalId: inputs.goal.id,
        lessonIds: [first],
        wait: "learner",
        writer,
      });

      return { saved, started: [...previous.started, ...written] };
    },
    times: FOLLOW_POLLS,
    wait: () => sleep(OUTLINE_POLL),
  });
}
