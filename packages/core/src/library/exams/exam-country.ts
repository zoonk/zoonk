import "server-only";
import { type ExamBlueprint, type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { refreshTestSummary } from "../../learner/placement/_utils/test-sitting";
import { isExamCountryOwed } from "../../view-models/onboarding/onboarding-steps";

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

/**
 * Research reads an exam's country, so the answer that gives the first one or a new one owes it:
 * the run waiting resumes, or one starts. A shared notice of the old country's exam is let go, so
 * nothing keeps teaching it; one that fits any country, or the learner's own, stays.
 */
export async function oweExamCountryResearch(
  tx: TransactionClient,
  before: Pick<Goal, "contentCountry" | "details" | "id" | "kind" | "userId">,
): Promise<void> {
  if (before.kind !== "exam") {
    return;
  }

  const after = await tx.goal.findUniqueOrThrow({
    include: { examBlueprint: { select: { country: true, ownerId: true } } },
    where: { id: before.id },
  });

  const details = isJsonObject(before.details) ? before.details : {};
  const waited = isExamCountryOwed({ details, kind: before.kind });

  if (!waited && after.contentCountry === before.contentCountry) {
    return;
  }

  const blueprint = after.examBlueprint;

  if (blueprint && !isOtherCountryExam({ blueprint, goal: after })) {
    return;
  }

  if (blueprint) {
    await tx.goal.update({ data: { examBlueprintId: null }, where: { id: after.id } });
    await refreshTestSummary({ goalId: after.id, tx });
  }

  await oweFollowUps({
    db: tx,
    followUps: [{ input: { goalId: after.id }, kind: "researchGoal" }],
    userId: after.userId,
  });
}
