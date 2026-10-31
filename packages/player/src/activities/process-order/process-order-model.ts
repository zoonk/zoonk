import { seededShuffle } from "@zoonk/utils/seeded-random";

export function shuffleSteps<TStep extends { id: string }>(
  steps: readonly TStep[],
  seedText: string,
): TStep[] {
  const shuffled = seededShuffle(steps, seedText);
  const isInOrder = shuffled.every((step, index) => step.id === steps[index]?.id);

  return isInOrder ? [...shuffled.slice(1), ...shuffled.slice(0, 1)] : shuffled;
}

export type StepResult = { id: string; learnerPosition: number | null; position: number };

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
