import {
  type MockQuestionWrites,
  listMockPrepWrites,
  loadMockWritingSkills,
} from "@zoonk/core/exams/mocks/prep";
import { type PlacementItemSkill } from "@zoonk/core/lookahead/placement-item-skills";

/** What the goal's exam's full mocks still need written, format by format (`listMockPrepWrites`). */
export async function listMockPrepWritesStep(goalId: string): Promise<MockQuestionWrites> {
  "use step";

  return listMockPrepWrites({ goalId });
}

/** The skills the item writer writes a mock's questions on (`loadMockWritingSkills`). */
export async function loadMockWritingSkillsStep(input: {
  goalId: string;
  skillIds: string[];
}): Promise<PlacementItemSkill[]> {
  "use step";

  return loadMockWritingSkills(input);
}
