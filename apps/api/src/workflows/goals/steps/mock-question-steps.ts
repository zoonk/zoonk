import {
  checkMockSupply,
  listDueMockGoals,
  listExamSupplyGoals,
  listMockPrepWrites,
  loadMockWritingSkills,
} from "@zoonk/core/exams/mocks/prep";

export async function listMockPrepWritesStep(
  input: Parameters<typeof listMockPrepWrites>[0],
): ReturnType<typeof listMockPrepWrites> {
  "use step";

  return listMockPrepWrites(input);
}

export async function loadMockWritingSkillsStep(input: {
  goalId: string;
  skillIds: string[];
}): ReturnType<typeof loadMockWritingSkills> {
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
  return checkMockSupply(goalId);
}
