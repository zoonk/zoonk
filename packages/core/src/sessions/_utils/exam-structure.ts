import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { type ExamPicks } from "../../exams/choices/exam-choices";
import { loadExamPicks } from "../../exams/choices/load-exam-choices";
import { readMockStructure } from "../../exams/mocks/_utils/read-mock-structure";
import { type ExamStructure } from "../../library/exams/blueprint-contract";

/** Includes only chosen exam options; dayMinutes bounds a class test's short mock. */
export async function loadExamStructure(
  goal: Pick<Goal, "examBlueprintId" | "id">,
  {
    blueprint: knownBlueprint,
    dayMinutes,
    picks: knownPicks,
  }: { blueprint?: ExamBlueprint | null; dayMinutes?: number | null; picks?: ExamPicks } = {},
): Promise<ExamStructure | null> {
  if (!goal.examBlueprintId) {
    return null;
  }

  const [blueprint, picks] = await Promise.all([
    knownBlueprint === undefined
      ? prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : knownBlueprint,
    knownPicks ?? loadExamPicks(goal.id),
  ]);

  return blueprint ? readMockStructure({ blueprint, dayMinutes, picks }) : null;
}
