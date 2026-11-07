import { isAnswerableStep } from "@zoonk/core/lesson-player/run";
import { type LessonPlayerState } from "../lesson-player-state";
import { type LessonRunAnswers, type PlayableLibraryStep } from "../lesson-player-types";
import { finishScreens, isAtEnd } from "./lesson-end";
import { enterPosition } from "./lesson-flow";
import { fromRunAnswer } from "./lesson-results";
import { isRetryStep } from "./lesson-steps";
import { omitKeys, pickKeys } from "./records";

type ShownAnswer = { answer: LessonRunAnswers[number]; step: PlayableLibraryStep };

function isAfterRightAnswer(answer: LessonRunAnswers[number], earlier: LessonRunAnswers): boolean {
  return earlier.some((other) => other.stepId === answer.stepId && other.isCorrect);
}

/** The server records nothing on a screen after its right answer, so a held answer behind one never counts. */
export function addHeldAnswers(
  answers: LessonRunAnswers,
  held: LessonRunAnswers,
): LessonRunAnswers {
  return [
    ...answers,
    ...held.filter(
      (answer, index) => !isAfterRightAnswer(answer, [...answers, ...held.slice(0, index)]),
    ),
  ];
}

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
  queue,
  steps,
}: {
  answers: LessonRunAnswers;
  queue: string[];
  steps: LessonPlayerState["steps"];
}): string[] {
  return queue.filter((stepId) => {
    const step = steps[stepId];
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
  const missedOnce = getMissedOnce({ answers, queue, steps: state.steps });

  return {
    ...state,
    queue: [...queue, ...missedOnce],
    retried: [...getRetried(answers), ...missedOnce],
  };
}

function getLessonQueue(state: LessonPlayerState): { position: number; queue: string[] } {
  const { quickCheck } = state;

  return quickCheck
    ? { position: quickCheck.returnPosition, queue: quickCheck.returnQueue }
    : { position: state.position, queue: state.queue };
}

/**
 * Screens the learner worked on keep that work and every other screen takes the run's answer, result
 * and retry, with the learner left where they are. First verdicts are the run's wherever it has one,
 * since those are what it counts.
 */
export function mergeUntouched(
  state: LessonPlayerState,
  answers: LessonRunAnswers,
): LessonPlayerState {
  const known = answers.filter((answer) => answer.stepId in state.steps);

  const untouched = Object.values(state.steps)
    .filter((step) => isAnswerableStep(step) && !state.actedOn.includes(step.id))
    .map((step) => step.id);

  const saved = known.filter((answer) => untouched.includes(answer.stepId));
  const restored = restoreAnswers(state, saved);
  const lesson = getLessonQueue(state);

  const kept = lesson.queue.filter(
    (id, index) =>
      index <= lesson.position || !untouched.includes(id) || lesson.queue.indexOf(id) === index,
  );

  const missedOnce = getMissedOnce({
    answers: saved,
    queue: [...new Set(kept)],
    steps: state.steps,
  });

  const owed = missedOnce.filter((id) => kept.indexOf(id) === kept.lastIndexOf(id));
  const queue = [...kept, ...owed];

  const merged = {
    ...state,
    answers: { ...omitKeys(state.answers, untouched), ...restored.answers },
    firstVerdicts: { ...pickKeys(state.firstVerdicts, state.actedOn), ...getRunVerdicts(known) },
    queue: state.quickCheck ? state.queue : queue,
    quickCheck: state.quickCheck && { ...state.quickCheck, returnQueue: queue },
    results: { ...omitKeys(state.results, untouched), ...restored.results },
    retried: [
      ...new Set([
        ...state.retried.filter((id) => !untouched.includes(id)),
        ...getRetried(saved),
        ...missedOnce,
      ]),
    ],
    revealed: restored.revealed,
  };

  const inView = state.queue[state.position] ?? "";
  const changesView = inView in merged.results !== inView in state.results;

  return !isAtEnd(state) && untouched.includes(inView) && changesView
    ? enterPosition(merged, state.position)
    : merged;
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
