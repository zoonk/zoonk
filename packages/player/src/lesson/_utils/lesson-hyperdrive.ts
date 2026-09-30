import { advanceHyperdrive, getHyperdriveLevel } from "@zoonk/core/sessions/brain-power";
import { type LessonPlayerState } from "../lesson-player-state";

/** x1 is every first right answer; Hyperdrive shows once two answers in a row are right. */
export const MIN_SHOWN_HYPERDRIVE = 2;

type HyperdriveRun = { level: number; top: number };

/**
 * Hyperdrive through the lesson, with the rule the server scores by: each screen's first answer,
 * in order, from where the run started (the session's streak). A right answer on a screen already
 * answered right before is a repeat and keeps it where it is; a wrong one resets it. Until the run
 * starts, the lesson counts from zero.
 */
function runHyperdrive(state: LessonPlayerState): HyperdriveRun {
  const start =
    state.run.status === "started" ? state.run.hyperdrive : { knownStepIds: [], streak: 0 };

  const known = new Set(start.knownStepIds);

  const { streak, top } = Object.entries(state.firstVerdicts).reduce(
    (current, [stepId, isCorrect]) => {
      const material = known.has(stepId) ? "repeat" : "new";
      const next = advanceHyperdrive({ answer: { isCorrect, material }, streak: current.streak });
      const builds = isCorrect && material === "new";

      return {
        streak: next,
        top: builds ? Math.max(current.top, getHyperdriveLevel(next)) : current.top,
      };
    },
    { streak: start.streak, top: 0 },
  );

  return { level: streak > 0 ? getHyperdriveLevel(streak) : 0, top };
}

/** Hyperdrive's multiplier right now, 0 without a streak. */
export function getLessonHyperdriveLevel(state: LessonPlayerState): number {
  return runHyperdrive(state).level;
}

/** The highest multiplier this lesson's answers reached, which Fun shows at the end. */
export function getLessonTopHyperdrive(state: LessonPlayerState): number {
  return runHyperdrive(state).top;
}
