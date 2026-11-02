import "server-only";
import { type ExamBlueprint, type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { readTestedLanguage } from "../../library/exams/blueprint-language";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { type ListeningPart, listListeningParts } from "./listening-parts";

export type ListeningExam = {
  blueprintId: string;
  language: string;
  name: string;
  parts: ListeningPart[];
  scriptLanguage: string;
};

export type ListeningGoal = Pick<Goal, "kind" | "targetLanguage"> & {
  examBlueprint: ExamBlueprint | null;
};

export function toListeningExam(goal: ListeningGoal): ListeningExam | null {
  const blueprint = goal.examBlueprint;

  if (goal.kind !== "exam" || blueprint?.visibility !== "public") {
    return null;
  }

  const scriptLanguage = readTestedLanguage(blueprint.structure) ?? goal.targetLanguage;
  const parts = listListeningParts(readBlueprintContent(blueprint).structure);

  if (!scriptLanguage || parts.length === 0) {
    return null;
  }

  return {
    blueprintId: blueprint.id,
    language: blueprint.language,
    name: blueprint.role ? `${blueprint.name}, ${blueprint.role}` : blueprint.name,
    parts,
    scriptLanguage,
  };
}

export async function loadListeningExam(
  goalId: string,
  tx: TransactionClient = prisma,
): Promise<ListeningExam | null> {
  const goal = await tx.goal.findUnique({
    select: { examBlueprint: true, kind: true, targetLanguage: true },
    where: { id: goalId },
  });

  return goal ? toListeningExam(goal) : null;
}
