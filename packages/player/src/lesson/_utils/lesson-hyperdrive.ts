import { advanceHyperdrive } from "@zoonk/core/sessions/brain-power";
import { type LessonPlayerState } from "../lesson-player-state";

const MIN_SHOWN_STREAK = 3;

type StreakStep = { builds: boolean; streak: number };

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
