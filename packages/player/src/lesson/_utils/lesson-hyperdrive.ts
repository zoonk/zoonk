import { advanceHyperdrive } from "@zoonk/core/sessions/brain-power";
import { type LessonPlayerState } from "../lesson-player-state";

/** Hyperdrive's quiet line shows from this many right answers in a row. */
const MIN_SHOWN_STREAK = 3;

type StreakStep = { builds: boolean; streak: number };

/**
 * The streak after each screen's first answer in this sitting, by the rule the server scores with:
 * in order, from the session's streak when the run started. A right answer on a screen answered
 * right before this run is a repeat and keeps the streak where it is; a wrong one resets it.
 * Answers from earlier sittings don't count: Hyperdrive never carries over from another day. Until
 * the run starts, the lesson counts from zero.
 */
function getStreaks(state: LessonPlayerState): Map<string, StreakStep> {
  const { run } = state;
  const start = run.status === "started" ? run.hyperdrive : { knownStepIds: [], streak: 0 };
  const carried = new Set(run.status === "started" ? run.carriedStepIds : []);
  const known = new Set(start.knownStepIds);

  const verdicts = Object.entries(state.firstVerdicts).filter(([stepId]) => !carried.has(stepId));

  const { steps } = verdicts.reduce(
    (current, [stepId, isCorrect]) => {
      const material = known.has(stepId) ? "repeat" : "new";
      const streak = advanceHyperdrive({ answer: { isCorrect, material }, streak: current.streak });
      const builds = isCorrect && material === "new";

      return { steps: [...current.steps, [stepId, { builds, streak }] as const], streak };
    },
    { steps: [] as (readonly [string, StreakStep])[], streak: start.streak },
  );

  return new Map(steps);
}

/**
 * Hyperdrive on a screen's result: the right answers in a row its first answer made, once there
 * are three or more. Null for a wrong answer, a repeat, a second try or a shorter streak.
 */
export function getHyperdriveStreak({
  state,
  stepId,
}: {
  state: LessonPlayerState;
  stepId: string;
}): number | null {
  const step = getStreaks(state).get(stepId);
  return step?.builds && step.streak >= MIN_SHOWN_STREAK ? step.streak : null;
}
