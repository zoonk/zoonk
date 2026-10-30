import {
  type MockQuestionWrites,
  listMockPrepWrites,
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
