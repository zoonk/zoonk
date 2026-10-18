import { type AnalyticsEvent } from "@zoonk/core/analytics/events";
import { type LessonPlayerState } from "../lesson-player-state";

/**
 * Wrong answers in a row before the screen the learner left: the latest result of each screen
 * seen so far, newest first, until a right one. Screens without an answer don't break the run.
 */
function countWrongInARow(state: LessonPlayerState): number {
  const seen = state.queue.slice(0, state.position + 1).toReversed();
  const latestFirst = seen.filter((stepId, index) => seen.indexOf(stepId) === index);

  const verdicts = latestFirst.flatMap((stepId) => {
    const result = state.results[stepId];
    return result ? [result.isCorrect] : [];
  });

  const firstRight = verdicts.indexOf(true);
  return firstRight === -1 ? verdicts.length : firstRight;
}

/**
 * "Activity Abandoned" for a learner leaving a lesson whose run started and hasn't finished, with
 * the screen they left and the wrong answers before it. Null when there's nothing to count: the
 * lesson never started, was refused, or was finished.
 */
export function getAbandonEvent(state: LessonPlayerState): AnalyticsEvent | null {
  if (state.run.status !== "started" || state.phase === "completed") {
    return null;
  }

  const stepId = state.queue[state.position];
  const step = stepId ? state.steps[stepId] : undefined;

  return {
    name: "Activity Abandoned",
    properties: {
      lesson_id: state.lessonId,
      screen: state.position + 1,
      step_kind: step?.kind ?? "unknown",
      wrong_in_a_row: countWrongInARow(state),
    },
  };
}
