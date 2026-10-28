import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { type ExamChoice } from "../../exams/choices/exam-choices";
import { loadExamChoices } from "../../exams/choices/load-exam-choices";
import { readMockStructure } from "../../exams/mocks/_utils/read-mock-structure";
import { type ExamStructure } from "../../library/exams/blueprint-contract";

/** Includes only chosen exam options; dayMinutes bounds a class test's short mock. */
export async function loadExamStructure(
  goal: Pick<Goal, "examBlueprintId" | "id">,
  {
    blueprint: knownBlueprint,
    choices: knownChoices,
    dayMinutes,
  }: {
    blueprint?: ExamBlueprint | null;
    choices?: readonly ExamChoice[];
    dayMinutes?: number | null;
  } = {},
): Promise<ExamStructure | null> {
  if (!goal.examBlueprintId) {
    return null;
  }

  const [blueprint, choices] = await Promise.all([
    knownBlueprint === undefined
      ? prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : knownBlueprint,
    knownChoices ?? loadExamChoices(goal.id),
  ]);

  return blueprint ? readMockStructure({ blueprint, choices, dayMinutes }) : null;
}
