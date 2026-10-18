import { seededShuffle } from "@zoonk/utils/seeded-random";

/**
 * The steps in the order the learner first sees them: shuffled the same way on every visit, and
 * never already in the right order, so there is always something to do.
 */
export function shuffleSteps<TStep extends { id: string }>(
  steps: readonly TStep[],
  seedText: string,
): TStep[] {
  const shuffled = seededShuffle(steps, seedText);
  const isInOrder = shuffled.every((step, index) => step.id === steps[index]?.id);

  return isInOrder ? [...shuffled.slice(1), ...shuffled.slice(0, 1)] : shuffled;
}

export type StepResult = {
  id: string;
  /** Where the learner put the step, 1-based, or null when it isn't in their order. */
  learnerPosition: number | null;
  position: number;
};

/** Each step in its true order, with where the learner put it. */
export function stepResults({
  expected,
  order,
}: {
  expected: readonly string[];
  order: readonly string[];
}): StepResult[] {
  return expected.map((id, index) => {
    const learnerIndex = order.indexOf(id);

    return {
      id,
      learnerPosition: learnerIndex === -1 ? null : learnerIndex + 1,
      position: index + 1,
    };
  });
}
