import { interleave } from "@zoonk/utils/interleave";
import { type MockCandidate, type MockSectionPlan } from "./mock-plan";

/** One skill after another, so a section mixes the area's skills instead of repeating one. */
function interleaveBySkill(candidates: readonly MockCandidate[]): MockCandidate[] {
  return interleave([...Map.groupBy(candidates, (candidate) => candidate.skillId).values()]);
}

/**
 * A section's questions in the order it asks them: the ones the learner never answered first,
 * mixing the skills, then the answered ones only for what's left, in the order they came (the
 * ones missed first; see `loadMockCandidates`).
 */
export function orderNewFirst(candidates: readonly MockCandidate[]): MockCandidate[] {
  return [
    ...interleaveBySkill(candidates.filter((candidate) => !candidate.answered)),
    ...candidates.filter((candidate) => candidate.answered),
  ];
}

/**
 * How many of the questions a mock's sections ask the learner answered before (see
 * `MockCandidate.answered`), at most as many as it asks: an adaptive module keeps two sets, of
 * which the learner answers one.
 */
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
