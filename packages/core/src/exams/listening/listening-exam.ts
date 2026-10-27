import "server-only";
import { type ExamBlueprint, type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { readTestedLanguage } from "../../library/exams/blueprint-language";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { type ListeningPart, listListeningParts } from "./listening-parts";

/** A goal's exam as its listening sets are written and found: shared by every learner of it. */
export type ListeningExam = {
  blueprintId: string;
  /** The learner's language, the blueprint's: the questions' reasons are in it. */
  language: string;
  name: string;
  parts: ListeningPart[];
  /**
   * The language its recordings are in: the one the notice says the exam tests ("en" for IELTS),
   * else the goal's target language.
   */
  scriptLanguage: string;
};

/** A goal as `toListeningExam` reads it. */
export type ListeningGoal = Pick<Goal, "kind" | "targetLanguage"> & {
  examBlueprint: ExamBlueprint | null;
};

/**
 * The goal's exam when it has listening to practice: an exam goal for a language (a certificate
 * such as IELTS or DELE) whose shared notice reading has a listening section. Null otherwise,
 * including a learner's own notice, whose words never go into shared recordings.
 */
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

/** `toListeningExam` for a goal by its id. */
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
