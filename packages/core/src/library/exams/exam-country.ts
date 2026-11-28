import "server-only";
import { type ExamBlueprint, type Goal, type TransactionClient } from "@zoonk/db";

const INTERNATIONAL = "ZZ";

/**
 * Exams run by different countries can share a name and teach different syllabuses, so an exam
 * goal whose learner gave a country never takes a shared notice of another country's exam.
 */
export function isOtherCountryExam({
  blueprint,
  goal,
}: {
  blueprint: Pick<ExamBlueprint, "country" | "ownerId">;
  goal: Pick<Goal, "contentCountry" | "kind">;
}): boolean {
  return (
    goal.kind === "exam" &&
    goal.contentCountry !== null &&
    blueprint.ownerId === null &&
    blueprint.country !== INTERNATIONAL &&
    blueprint.country !== goal.contentCountry
  );
}

/** The exam a new goal names, unless it is another country's than the one the learner gave. */
export async function findCountryExamId(
  tx: TransactionClient,
  {
    contentCountry,
    examBlueprintId,
    kind,
  }: Pick<Goal, "contentCountry" | "kind"> & { examBlueprintId?: string | null },
): Promise<string | null> {
  if (!examBlueprintId) {
    return null;
  }

  const blueprint = await tx.examBlueprint.findUnique({
    select: { country: true, ownerId: true },
    where: { id: examBlueprintId },
  });

  const isOther = blueprint && isOtherCountryExam({ blueprint, goal: { contentCountry, kind } });

  return isOther ? null : examBlueprintId;
}
