import { type CallWait } from "@zoonk/ai/provider-options";
import { type GoalCurriculumInputs } from "@zoonk/core/library/curriculum/goal-curriculum-inputs";
import { sleep } from "workflow";
import { start } from "workflow/api";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { retryPlanConflicts } from "../_shared/plan-conflict-retry";
import { repeatUntil } from "../_shared/repeat-until";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import {
  createGoalGenerationManifestStep,
  pickPlanStartToWriteStep,
  pickSpeculativeLessonsStep,
  readGoalLookaheadStep,
  readPlanOpeningStep,
  readPlanOpeningTokenStep,
} from "./steps/goal-lookahead-steps";

const OUTLINE_POLL = "5s";
const MAX_OUTLINE_POLLS = 48;
const FOLLOW_POLLS = 60;

type PlanOpening = (string | null)[];

type Followed = { openingToken: string | null | undefined; started: string[] };

function hasFirstLesson(opening: PlanOpening): boolean {
  return typeof opening[0] === "string";
}

/** A Library chapter can land before the band the learner reaches first, so one real lesson isn't enough. */
function isOpeningOutlined(opening: PlanOpening): boolean {
  return opening.length > 0 && opening.every((lessonId) => lessonId !== null);
}

async function waitForOpening({
  done,
  goalId,
}: {
  done: (opening: PlanOpening) => boolean;
  goalId: string;
}): Promise<PlanOpening> {
  const result = await repeatUntil<{ opening: PlanOpening; token: string | null }>({
    done: ({ opening }) => done(opening),
    run: async (previous) => {
      const token = await readPlanOpeningTokenStep(goalId);

      return previous?.token === token
        ? previous
        : { opening: await readPlanOpeningStep(goalId), token };
    },
    times: MAX_OUTLINE_POLLS,
    wait: () => sleep(OUTLINE_POLL),
  });

  return result.opening;
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
  const planManifest =
    lessonIds.length > 0
      ? await retryPlanConflicts(createGoalGenerationManifestStep, { goalId, lessonIds })
      : null;

  const admitted = planManifest?.targets.map((target) => target.lessonId) ?? [];

  await Promise.all(
    admitted.map((lessonId) =>
      start(lessonContentWorkflow, [
        { ...writer, lessonId, planGoalId: goalId, planManifest, wait },
      ]),
    ),
  );

  return admitted;
}

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

  const left = count - first.length;

  if (left <= 0) {
    return first;
  }

  await waitForOpening({ done: isOpeningOutlined, goalId });
  const guesses = await pick();

  const unstarted = guesses.map((guess) => guess.filter((lessonId) => !first.includes(lessonId)));

  const leads = unstarted.slice(1).flatMap((guess) => guess.slice(0, 1));
  const rest = unstarted.flat().filter((lessonId) => !leads.includes(lessonId));

  const started = await writeLessons({
    goalId,
    lessonIds: [...leads, ...rest].slice(0, left),
    writer,
  });

  return [...first, ...started];
}

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

  const initial: Followed = { openingToken: undefined, started };

  await repeatUntil<Followed>({
    done: () => false,
    run: async (previous = initial) => {
      const openingToken = await readPlanOpeningTokenStep(inputs.goal.id);

      if (openingToken === previous.openingToken) {
        return previous;
      }

      const first = await pickPlanStartToWriteStep(inputs.goal.id);

      if (!first || previous.started.includes(first)) {
        return { openingToken, started: previous.started };
      }

      const written = await writeLessons({
        goalId: inputs.goal.id,
        lessonIds: [first],
        wait: "learner",
        writer,
      });

      return { openingToken, started: [...previous.started, ...written] };
    },
    times: FOLLOW_POLLS,
    wait: () => sleep(OUTLINE_POLL),
  });
}
