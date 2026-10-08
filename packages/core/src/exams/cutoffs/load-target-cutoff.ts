import "server-only";
import { prisma } from "@zoonk/db";
import { type CutoffTarget, getCutoffTarget } from "./cutoff-target";
import { type TargetCutoff } from "./target-cutoff-contract";

/**
 * The latest cut-off a lookup found for the goal's target in this exam (a year's lookup that found
 * none leaves the one before, which names its own edition). Null without a target, a shared exam
 * or a found cut-off: nothing is guessed.
 */
export async function loadTargetCutoff({
  details,
  examBlueprintId,
}: {
  details: unknown;
  examBlueprintId: string | null | undefined;
}): Promise<TargetCutoff | null> {
  if (!examBlueprintId) {
    return null;
  }

  const blueprint = await prisma.examBlueprint.findUnique({
    select: { ownerId: true, role: true },
    where: { id: examBlueprintId },
  });

  const target =
    blueprint && !blueprint.ownerId ? getCutoffTarget({ details, role: blueprint.role }) : null;

  return target ? findCutoff({ examBlueprintId, target }) : null;
}

async function findCutoff({
  examBlueprintId,
  target,
}: {
  examBlueprintId: string;
  target: CutoffTarget;
}): Promise<TargetCutoff | null> {
  const row = await prisma.targetCutoff.findFirst({
    orderBy: { year: "desc" },
    where: { examBlueprintId, status: "found", targetKey: target.key },
  });

  if (!row || row.score === null || !row.sourceUrl) {
    return null;
  }

  return {
    course: target.course,
    edition: row.edition,
    institution: target.institution,
    position: target.position,
    quota: row.quota,
    score: row.score,
    source: { title: row.sourceTitle, url: row.sourceUrl },
  };
}
