import { getTestQuestionStatuses } from "../focus-test-progress";
import { readSkillStatuses } from "../placement-known";
import { type TestTurn } from "./focus-test-setup";
import { type TestSkillAnswers } from "./placement-evidence";

type StatusFacts = Parameters<typeof readSkillStatuses>[0] & {
  testSkills: readonly TestSkillAnswers[];
  turn: TestTurn | null;
};

export function readStatuses({ testSkills, turn, ...facts }: StatusFacts) {
  const statuses = readSkillStatuses(facts);

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
