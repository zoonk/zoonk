import { isAnswerableStep } from "@zoonk/core/lesson-player/run";
import { type LessonPlayerState } from "../lesson-player-state";
import { type LessonRunAnswers, type PlayableLibraryStep } from "../lesson-player-types";
import { finishScreens } from "./lesson-end";
import { enterPosition } from "./lesson-flow";
import { fromRunAnswer } from "./lesson-results";
import { isRetryStep } from "./lesson-steps";
import { pickKeys } from "./records";

type ShownAnswer = { answer: LessonRunAnswers[number]; step: PlayableLibraryStep };

export function getRunVerdicts(answers: LessonRunAnswers): Record<string, boolean> {
  return Object.fromEntries(
    answers
      .filter(
        (answer, index) => answers.findIndex((other) => other.stepId === answer.stepId) === index,
      )
      .map((answer) => [answer.stepId, answer.isCorrect]),
  );
}

function getMissedOnce({
  answers,
  state,
}: {
  answers: LessonRunAnswers;
  state: LessonPlayerState;
}): string[] {
  return state.queue.filter((stepId) => {
    const step = state.steps[stepId];
    const tries = answers.filter((answer) => answer.stepId === stepId);

    return step && isRetryStep(step) && tries.length === 1 && tries[0]?.isCorrect === false;
  });
}

function getRetried(answers: LessonRunAnswers): string[] {
  const stepIds = answers.map((answer) => answer.stepId);
  return [...new Set(stepIds.filter((stepId, index) => stepIds.indexOf(stepId) !== index))];
}

function getResumePosition({
  answered,
  lessonLength,
  queue,
  steps,
}: {
  answered: ReadonlySet<string>;
  lessonLength: number;
  queue: string[];
  steps: LessonPlayerState["steps"];
}): number {
  const isAnswerable = (stepId: string) => {
    const step = steps[stepId];
    return step !== undefined && isAnswerableStep(step);
  };

  const open = queue.findIndex(
    (stepId, index) => isAnswerable(stepId) && (index >= lessonLength || !answered.has(stepId)),
  );

  if (open === -1) {
    return queue.length;
  }

  const readingBefore = queue
    .slice(0, open)
    .toReversed()
    .findIndex((stepId) => isAnswerable(stepId));

  return readingBefore === -1 ? 0 : open - readingBefore;
}

function getShownAnswers(state: LessonPlayerState, answers: LessonRunAnswers): ShownAnswer[] {
  const last = new Map(answers.map((answer) => [answer.stepId, answer]));

  return [...last.values()].flatMap((answer) => {
    const step = state.steps[answer.stepId];
    return step ? [{ answer, step }] : [];
  });
}

function getAnswerEntry({ answer }: ShownAnswer) {
  return answer.answer ? [[answer.stepId, answer.answer] as const] : [];
}

function getChallengeEntry({ answer }: ShownAnswer) {
  return answer.answer?.kind === "challenge"
    ? [[answer.stepId, answer.answer.choiceIds.length + 1] as const]
    : [];
}

/** Each screen shows its last answer; a challenge opens on its ending. */
function restoreAnswers(state: LessonPlayerState, answers: LessonRunAnswers): LessonPlayerState {
  const shown = getShownAnswers(state, answers);

  return {
    ...state,
    answers: Object.fromEntries(shown.flatMap((item) => getAnswerEntry(item))),
    results: Object.fromEntries(shown.map((item) => [item.answer.stepId, fromRunAnswer(item)])),
    revealed: {
      ...state.revealed,
      ...Object.fromEntries(shown.flatMap((item) => getChallengeEntry(item))),
    },
  };
}

/** Only screens already showing a result take the fresher one, so a question started over stays so. */
export function refreshAnswers(
  state: LessonPlayerState,
  answers: LessonRunAnswers,
): LessonPlayerState {
  const restored = restoreAnswers(state, answers);
  const shown = Object.keys(state.results);

  return {
    ...state,
    answers: { ...state.answers, ...pickKeys(restored.answers, shown) },
    results: { ...state.results, ...pickKeys(restored.results, shown) },
  };
}

/** The queue may already hold retries; the answers decide them again. */
export function requeueRetries(
  state: LessonPlayerState,
  answers: LessonRunAnswers,
): LessonPlayerState {
  const queue = state.queue.filter((stepId, index) => state.queue.indexOf(stepId) === index);
  const missedOnce = getMissedOnce({ answers, state: { ...state, queue } });

  return {
    ...state,
    queue: [...queue, ...missedOnce],
    retried: [...getRetried(answers), ...missedOnce],
  };
}

export function resumeLesson(
  state: LessonPlayerState,
  answers: LessonRunAnswers,
): LessonPlayerState {
  const known = answers.filter((answer) => answer.stepId in state.steps);

  if (known.length === 0) {
    return state;
  }

  const resumed = {
    ...requeueRetries(restoreAnswers(state, known), known),
    firstVerdicts: getRunVerdicts(known),
  };

  const position = getResumePosition({
    answered: new Set(known.map((answer) => answer.stepId)),
    lessonLength: state.queue.length,
    queue: resumed.queue,
    steps: state.steps,
  });

  if (position >= resumed.queue.length) {
    return finishScreens({ ...resumed, position: resumed.queue.length - 1 }, "ready");
  }

  return enterPosition(resumed, position);
}
