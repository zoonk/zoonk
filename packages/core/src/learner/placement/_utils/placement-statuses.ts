import { getTestQuestionStatuses } from "../focus-test-progress";
import { readSkillStatuses } from "../placement-known";
import { type SkillStatuses } from "../placement-status";
import { type TestTurn } from "./focus-test-setup";
import { type TestSkillAnswers } from "./placement-evidence";

type StatusFacts = Parameters<typeof readSkillStatuses>[0] & {
  /** Skills a measured level places as known, whatever the answers say. */
  measuredKnown: ReadonlySet<string>;
  testSkills: readonly TestSkillAnswers[];
  turn: TestTurn | null;
};

export function readStatuses({ measuredKnown, testSkills, turn, ...facts }: StatusFacts) {
  const statuses: SkillStatuses = new Map(
    [...readSkillStatuses(facts)].map(([skillId, status]) => [
      skillId,
      measuredKnown.has(skillId) ? "known" : status,
    ]),
  );

  const questionStatuses = turn
    ? getTestQuestionStatuses({
        areaOf: (skillId) => turn.setup.areaOf.get(skillId) ?? null,
        statuses,
        subjects: turn.setup.subjects,
        testSkills,
      })
    : statuses;

  return { questionStatuses, statuses };
}
