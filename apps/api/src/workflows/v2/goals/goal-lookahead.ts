import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { repeatUntil } from "../_shared/repeat-until";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { pickSpeculativeLessonsStep, readPlanOpeningStep } from "./steps/goal-lookahead-steps";

/** The first outline band takes about a minute; placement runs meanwhile. */
const OUTLINE_POLL = "5s";
const MAX_OUTLINE_POLLS = 48;
/** How long the plan's start is followed after the first lessons start: placement and the last bands. */
const FOLLOW_POLLS = 60;

type PlanOpening = (string | null)[];

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

function writeLessons({
  lessonIds,
  priority,
  writer,
}: {
  lessonIds: string[];
  priority: boolean;
  writer: LessonWriter;
}) {
  return Promise.all(
    lessonIds.map((lessonId) => start(lessonContentWorkflow, [{ ...writer, lessonId, priority }])),
  );
}

/**
 * While placement runs, the first lessons of the two likeliest starting phases start generating,
 * so the first lesson is ready when placement ends. The plan's first lesson starts the moment its
 * band lands, at the priority tier, since the learner opens it next. The rest follow once the
 * whole opening is outlined: the first lesson of the other guessed phase at the priority tier too,
 * since placement may start the learner there, and the others at the standard tier, since the
 * learner reaches them minutes later. Guests never trigger speculative work.
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

  const pick = async (): Promise<string[][]> =>
    inputs.isGuest ? [] : pickSpeculativeLessonsStep({ goalId, ownLevel });

  await waitForOpening({ done: hasFirstLesson, goalId });
  const [firstGuess = []] = await pick();
  const first = firstGuess.slice(0, 1);
  await writeLessons({ lessonIds: first, priority: true, writer });

  await waitForOpening({ done: isOpeningOutlined, goalId });
  const guesses = await pick();
  const unstarted = guesses.map((guess) => guess.filter((lessonId) => !first.includes(lessonId)));
  const leads = unstarted.slice(1).flatMap((guess) => guess.slice(0, 1));
  const rest = unstarted.flat().filter((lessonId) => !leads.includes(lessonId));

  await Promise.all([
    writeLessons({ lessonIds: leads, priority: true, writer }),
    writeLessons({ lessonIds: rest, priority: false, writer }),
  ]);

  return [...first, ...leads, ...rest];
}

/**
 * The plan's start still moves after its first lessons start: placement moves the learner past
 * what they know, and each band that lands re-plans with its real lessons. For a few minutes, the
 * plan's first lesson is written at the priority tier the moment the start moves to one nobody
 * started, so it's ready when the learner opens it; one already written ends its run at once.
 * Guests never trigger speculative work.
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

  await repeatUntil<string[]>({
    done: () => false,
    run: async (previous = started) => {
      const [first] = await readPlanOpeningStep(inputs.goal.id);

      if (!first || previous.includes(first)) {
        return previous;
      }

      await writeLessons({ lessonIds: [first], priority: true, writer });
      return [...previous, first];
    },
    times: FOLLOW_POLLS,
    wait: () => sleep(OUTLINE_POLL),
  });
}
