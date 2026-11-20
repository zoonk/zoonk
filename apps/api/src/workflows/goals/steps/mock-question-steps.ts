import {
  type MockQuestionWrites,
  listMockPrepWrites,
  checkMockSupply,
  listExamSupplyGoals,
  listDueMockGoals,
  loadMockWritingSkills,
} from "@zoonk/core/exams/mocks/prep";
import { type PlacementItemSkill } from "@zoonk/core/lookahead/placement-item-skills";

export async function listMockPrepWritesStep(goalId: string): Promise<MockQuestionWrites> {
  "use step";

  return listMockPrepWrites({ goalId });
}

export async function loadMockWritingSkillsStep(input: {
  goalId: string;
  skillIds: string[];
}): Promise<PlacementItemSkill[]> {
  "use step";

  return loadMockWritingSkills(input);
}

export async function listDueMockGoalsStep() {
  "use step";
  return listDueMockGoals();
}
export async function listExamSupplyGoalsStep(input: Parameters<typeof listExamSupplyGoals>[0]) {
  "use step";
  return listExamSupplyGoals(input);
}
export async function checkMockSupplyStep(goalId: string) {
  "use step";
  await checkMockSupply(goalId);
}
