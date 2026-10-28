import { interleave } from "@zoonk/utils/interleave";
import { type MockCandidate, type MockSectionPlan } from "./mock-plan";

function interleaveBySkill(candidates: readonly MockCandidate[]): MockCandidate[] {
  return interleave([...Map.groupBy(candidates, (candidate) => candidate.skillId).values()]);
}

export function orderNewFirst(candidates: readonly MockCandidate[]): MockCandidate[] {
  return [
    ...interleaveBySkill(candidates.filter((candidate) => !candidate.answered)),
    ...candidates.filter((candidate) => candidate.answered),
  ];
}

export function countReused({
  candidates,
  sections,
}: {
  candidates: readonly MockCandidate[];
  sections: readonly MockSectionPlan[];
}): number {
  const answered = new Set(
    candidates.filter((candidate) => candidate.answered).map((candidate) => candidate.itemId),
  );

  const ids = new Set(
    sections.flatMap((section) =>
      section.routing ? [...section.routing.easier, ...section.routing.harder] : section.itemIds,
    ),
  );

  const asked = sections.reduce((sum, section) => sum + section.questions, 0);
  return Math.min(asked, [...ids].filter((id) => answered.has(id)).length);
}
